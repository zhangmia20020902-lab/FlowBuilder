const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const { requireAuth } = require("../middleware/auth");
const { query } = require("../config/database");
const {
  validateCompanyUpdate,
  validateUserCreation,
  validateUserUpdate,
} = require("../middleware/validation");

// Company profile view
router.get("/company/profile", requireAuth, async (req, res) => {
  try {
    const companyId = req.session.companyId;

    const companies = await query("SELECT * FROM companies WHERE id = ?", [
      companyId,
    ]);

    if (!companies || companies.length === 0) {
      return res.status(404).render("shared/error", {
        message: "Company not found",
        error: { status: 404, stack: "" },
      });
    }

    const company = companies[0];

    // Get company statistics
    const userCount = await query(
      "SELECT COUNT(*) as count FROM users WHERE company_id = ?",
      [companyId]
    );

    const projectCount = await query(
      "SELECT COUNT(*) as count FROM projects WHERE company_id = ?",
      [companyId]
    );

    const supplierCount = await query(
      "SELECT COUNT(*) as count FROM company_partnerships WHERE source_company_id = ?",
      [companyId]
    );

    const materialCount = await query(
      "SELECT COUNT(*) as count FROM materials WHERE company_id = ?",
      [companyId]
    );

    res.render("companies/company-profile", {
      title: `${company.name} - FlowBuilder`,
      company,
      stats: {
        users: userCount[0].count,
        projects: projectCount[0].count,
        suppliers: supplierCount[0].count,
        materials: materialCount[0].count,
      },
    });
  } catch (error) {
    console.error("Company profile error:", error);
    res.status(500).render("shared/error", {
      message: "Error loading company profile",
      error: { status: 500, stack: error.stack },
    });
  }
});

// Edit company form
router.get("/company/edit", requireAuth, async (req, res) => {
  try {
    const companyId = req.session.companyId;

    const companies = await query("SELECT * FROM companies WHERE id = ?", [
      companyId,
    ]);

    if (!companies || companies.length === 0) {
      return res.status(404).render("shared/error", {
        message: "Company not found",
        error: { status: 404, stack: "" },
      });
    }

    const company = companies[0];

    res.render("companies/company-edit", {
      title: `Edit ${company.name} - FlowBuilder`,
      company,
    });
  } catch (error) {
    console.error("Company edit form error:", error);
    res.status(500).render("shared/error", {
      message: "Error loading company form",
      error: { status: 500, stack: error.stack },
    });
  }
});

// Update company API
router.post(
  "/company/update",
  requireAuth,
  validateCompanyUpdate,
  async (req, res) => {
    try {
      const companyId = req.session.companyId;
      const { name, address } = req.body;

      await query("UPDATE companies SET name = ?, address = ? WHERE id = ?", [
        name,
        address || null,
        companyId,
      ]);

      req.session.flash = {
        success: "Company updated successfully",
      };
      req.session.save((err) => {
        if (err) console.error("Session save error:", err);
        res.redirect("/company/profile");
      });
    } catch (error) {
      console.error("Company update error:", error);
      req.session.flash = {
        error: "Error updating company",
      };
      req.session.save((err) => {
        if (err) console.error("Session save error:", err);
        res.redirect("/company/edit");
      });
    }
  }
);

// List all users
router.get("/company/users", requireAuth, async (req, res) => {
  try {
    const companyId = req.session.companyId;
    const userRole = req.session.userRole;

    const users = await query(
      `SELECT u.*, r.name as role_name 
       FROM users u 
       JOIN roles r ON u.role_id = r.id 
       WHERE u.company_id = ? 
       ORDER BY u.created_at DESC`,
      [companyId]
    );

    // Check if there's only one user (for supplier delete restriction)
    const isOnlyUser = users.length === 1;
    const isSupplier = userRole === "Supplier";

    res.render("companies/users-list", {
      title: "Manage Users - FlowBuilder",
      users,
      isOnlyUser,
      isSupplier,
    });
  } catch (error) {
    console.error("Users list error:", error);
    res.status(500).render("shared/error", {
      message: "Error loading users",
      error: { status: 500, stack: error.stack },
    });
  }
});

// Create user form
router.get("/company/users/create", requireAuth, async (req, res) => {
  try {
    const userRole = req.session.userRole;
    const isSupplier = userRole === "Supplier";

    // Get roles for dropdown - filter to only Supplier role for supplier companies
    let roles;
    if (isSupplier) {
      roles = await query(
        "SELECT * FROM roles WHERE name = 'Supplier' ORDER BY name ASC"
      );
    } else {
      roles = await query("SELECT * FROM roles ORDER BY name ASC");
    }

    res.render("companies/user-create", {
      title: "Create User - FlowBuilder",
      roles,
      isSupplier,
    });
  } catch (error) {
    console.error("User create form error:", error);
    res.status(500).render("shared/error", {
      message: "Error loading user form",
      error: { status: 500, stack: error.stack },
    });
  }
});

// Create user API
router.post(
  "/company/users",
  requireAuth,
  validateUserCreation,
  async (req, res) => {
    try {
      const companyId = req.session.companyId;
      const { name, email, role_id, password } = req.body;

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      await query(
        "INSERT INTO users (company_id, role_id, name, email, password) VALUES (?, ?, ?, ?, ?)",
        [companyId, role_id, name, email, hashedPassword]
      );

      req.session.flash = {
        success: "User created successfully",
      };
      req.session.save((err) => {
        if (err) console.error("Session save error:", err);
        res.redirect("/company/users");
      });
    } catch (error) {
      console.error("User create error:", error);
      req.session.flash = {
        error: "Error creating user",
      };
      req.session.save((err) => {
        if (err) console.error("Session save error:", err);
        res.redirect("/company/users/create");
      });
    }
  }
);

// Edit user form
router.get("/company/users/:id/edit", requireAuth, async (req, res) => {
  try {
    const userId = req.params.id;
    const companyId = req.session.companyId;
    const userRole = req.session.userRole;
    const isSupplier = userRole === "Supplier";

    const users = await query(
      "SELECT * FROM users WHERE id = ? AND company_id = ?",
      [userId, companyId]
    );

    if (!users || users.length === 0) {
      return res.status(404).render("shared/error", {
        message: "User not found",
        error: { status: 404, stack: "" },
      });
    }

    const user = users[0];

    // Get roles for dropdown - filter to only Supplier role for supplier companies
    let roles;
    if (isSupplier) {
      roles = await query(
        "SELECT * FROM roles WHERE name = 'Supplier' ORDER BY name ASC"
      );
    } else {
      roles = await query("SELECT * FROM roles ORDER BY name ASC");
    }

    res.render("companies/user-edit", {
      title: `Edit ${user.name} - FlowBuilder`,
      user,
      roles,
      isSupplier,
    });
  } catch (error) {
    console.error("User edit form error:", error);
    res.status(500).render("shared/error", {
      message: "Error loading user form",
      error: { status: 500, stack: error.stack },
    });
  }
});

// Update user API
router.post(
  "/company/users/:id/update",
  requireAuth,
  validateUserUpdate,
  async (req, res) => {
    try {
      const userId = req.params.id;
      const companyId = req.session.companyId;
      const { name, email, role_id, password } = req.body;

      // Verify user belongs to company
      const users = await query(
        "SELECT * FROM users WHERE id = ? AND company_id = ?",
        [userId, companyId]
      );

      if (!users || users.length === 0) {
        return res.status(404).render("shared/error", {
          message: "User not found",
          error: { status: 404, stack: "" },
        });
      }

      // Update user (with or without password)
      if (password && password.trim()) {
        // Hash new password
        const hashedPassword = await bcrypt.hash(password, 10);
        await query(
          "UPDATE users SET name = ?, email = ?, role_id = ?, password = ? WHERE id = ? AND company_id = ?",
          [name, email, role_id, hashedPassword, userId, companyId]
        );
      } else {
        await query(
          "UPDATE users SET name = ?, email = ?, role_id = ? WHERE id = ? AND company_id = ?",
          [name, email, role_id, userId, companyId]
        );
      }

      req.session.flash = {
        success: "User updated successfully",
      };
      req.session.save((err) => {
        if (err) console.error("Session save error:", err);
        res.redirect("/company/users");
      });
    } catch (error) {
      console.error("User update error:", error);
      req.session.flash = {
        error: "Error updating user",
      };
      req.session.save((err) => {
        if (err) console.error("Session save error:", err);
        res.redirect(`/company/users/${req.params.id}/edit`);
      });
    }
  }
);

// Delete user API
router.post("/company/users/:id/delete", requireAuth, async (req, res) => {
  try {
    const userId = req.params.id;
    const companyId = req.session.companyId;
    const currentUserId = req.session.userId;

    // Prevent self-deletion
    if (parseInt(userId) === parseInt(currentUserId)) {
      req.session.flash = {
        error: "Cannot delete your own account",
      };
      req.session.save((err) => {
        if (err) console.error("Session save error:", err);
        res.redirect("/company/users");
      });
      return;
    }

    // Check if this is the only user in the company (for supplier restriction)
    const userCount = await query(
      "SELECT COUNT(*) as count FROM users WHERE company_id = ?",
      [companyId]
    );

    if (userCount[0].count <= 1) {
      req.session.flash = {
        error:
          "Cannot delete the only user account. At least one user must remain.",
      };
      req.session.save((err) => {
        if (err) console.error("Session save error:", err);
        res.redirect("/company/users");
      });
      return;
    }

    // Verify user belongs to company
    const users = await query(
      "SELECT * FROM users WHERE id = ? AND company_id = ?",
      [userId, companyId]
    );

    if (!users || users.length === 0) {
      return res.status(404).render("shared/error", {
        message: "User not found",
        error: { status: 404, stack: "" },
      });
    }

    // Check if user created RFQs or POs
    const hasActivity = await query(
      "SELECT COUNT(*) as count FROM rfqs WHERE created_by = ?",
      [userId]
    );

    if (hasActivity[0].count > 0) {
      req.session.flash = {
        error: "Cannot delete user: has created RFQs or POs",
      };
      req.session.save((err) => {
        if (err) console.error("Session save error:", err);
        res.redirect("/company/users");
      });
      return;
    }

    // Delete user
    await query("DELETE FROM users WHERE id = ? AND company_id = ?", [
      userId,
      companyId,
    ]);

    req.session.flash = {
      success: "User deleted successfully",
    };
    req.session.save((err) => {
      if (err) console.error("Session save error:", err);
      res.redirect("/company/users");
    });
  } catch (error) {
    console.error("User delete error:", error);
    req.session.flash = {
      error: "Error deleting user",
    };
    req.session.save((err) => {
      if (err) console.error("Session save error:", err);
      res.redirect("/company/users");
    });
  }
});

// List all roles (read-only for MVP)
router.get("/company/roles", requireAuth, async (req, res) => {
  try {
    const roles = await query("SELECT * FROM roles ORDER BY name ASC");

    res.render("companies/roles-list", {
      title: "Roles - FlowBuilder",
      roles,
    });
  } catch (error) {
    console.error("Roles list error:", error);
    res.status(500).render("shared/error", {
      message: "Error loading roles",
      error: { status: 500, stack: error.stack },
    });
  }
});

module.exports = router;
