const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const { requireAuth } = require("../middleware/auth");
const { query } = require("../config/database");
const {
  validateSupplierCreation,
  validateSupplierUpdate,
} = require("../middleware/validation");

// List all supplier companies with search
router.get("/suppliers", requireAuth, async (req, res) => {
  try {
    const companyId = req.session.companyId;
    const { search, trade_specialty } = req.query;

    // Pagination settings
    const itemsPerPage = 10;
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const offset = (page - 1) * itemsPerPage;

    // Build WHERE conditions - query companies with type='supplier'
    let whereClause = "WHERE c.type = 'supplier'";
    const params = [companyId]; // For partnership LEFT JOIN

    if (search && search.trim()) {
      whereClause +=
        " AND (c.name LIKE ? OR c.email LIKE ? OR c.trade_specialty LIKE ?)";
      const searchTerm = `%${search.trim()}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (trade_specialty && trade_specialty !== "all") {
      whereClause += " AND c.trade_specialty = ?";
      params.push(trade_specialty);
    }

    // Count total items for pagination
    const countSql = `
      SELECT COUNT(*) as total 
      FROM companies c
      LEFT JOIN company_partnerships cp ON c.id = cp.target_company_id AND cp.source_company_id = ?
      ${whereClause}
    `;
    const countResult = await query(countSql, params);
    const totalItems = countResult[0].total;
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    // Get paginated supplier companies
    const sql = `
      SELECT c.*, 
        CASE WHEN cp.source_company_id IS NOT NULL THEN 'partnered' ELSE 'not_partnered' END as partnership_status,
        cp.status as partnership_status_detail,
        cp.notes as partnership_notes
      FROM companies c
      LEFT JOIN company_partnerships cp ON c.id = cp.target_company_id AND cp.source_company_id = ?
      ${whereClause}
      ORDER BY c.name ASC
      LIMIT ${itemsPerPage} OFFSET ${offset}
    `;
    const suppliers = await query(sql, [companyId, ...params.slice(1)]);

    // Get unique trade specialties for filter
    const specialties = await query(
      "SELECT DISTINCT trade_specialty FROM companies WHERE type = 'supplier' AND trade_specialty IS NOT NULL ORDER BY trade_specialty ASC"
    );

    // Build pagination data
    const startPage = Math.max(1, page - 2);
    const endPage = Math.min(totalPages, page + 2);

    const pagination = {
      currentPage: page,
      totalPages,
      totalItems,
      itemsPerPage,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
      nextPage: page + 1,
      prevPage: page - 1,
      startItem: totalItems > 0 ? (page - 1) * itemsPerPage + 1 : 0,
      endItem: Math.min(page * itemsPerPage, totalItems),
      showFirstPage: startPage > 1,
      showFirstEllipsis: startPage > 2,
      showLastPage: endPage < totalPages,
      showLastEllipsis: endPage < totalPages - 1,
      pages: [],
    };

    // Generate page numbers array (show max 5 pages around current)
    for (let i = startPage; i <= endPage; i++) {
      pagination.pages.push({
        number: i,
        isActive: i === page,
      });
    }

    res.render("suppliers/suppliers", {
      title: "Suppliers Directory - FlowBuilder",
      suppliers,
      specialties,
      search: search || "",
      selectedSpecialty: trade_specialty || "all",
      pagination,
    });
  } catch (error) {
    console.error("Suppliers list error:", error);
    res.status(500).render("shared/error", {
      message: "Error loading suppliers",
      error: { status: 500, stack: error.stack },
    });
  }
});

// Create supplier form
router.get("/suppliers/create", requireAuth, async (req, res) => {
  try {
    // Get all categories for trade specialty dropdown
    const categories = await query(
      "SELECT * FROM categories ORDER BY name ASC"
    );

    res.render("suppliers/supplier-create", {
      title: "Create Supplier - FlowBuilder",
      categories,
    });
  } catch (error) {
    console.error("Supplier create form error:", error);
    res.status(500).render("shared/error", {
      message: "Error loading supplier form",
      error: { status: 500, stack: error.stack },
    });
  }
});

// Create supplier API - creates a new company with type='supplier'
// Also creates partnership and user account for the supplier
router.post(
  "/suppliers",
  requireAuth,
  validateSupplierCreation,
  async (req, res) => {
    try {
      const companyId = req.session.companyId;
      const { name, email, trade_specialty } = req.body;

      // Create the supplier company
      const result = await query(
        "INSERT INTO companies (name, type, email, trade_specialty) VALUES (?, 'supplier', ?, ?)",
        [name, email || null, trade_specialty || null]
      );

      const newSupplierId = result.insertId;

      // Automatically create partnership between the creating company and the new supplier
      await query(
        "INSERT INTO company_partnerships (source_company_id, target_company_id, status, notes) VALUES (?, ?, 'active', 'Auto-created on supplier creation')",
        [companyId, newSupplierId]
      );

      // Create a user account for the supplier if email is provided
      if (email) {
        // Get the Supplier role ID
        const roles = await query(
          "SELECT id FROM roles WHERE name = 'Supplier' LIMIT 1"
        );
        if (roles && roles.length > 0) {
          const supplierRoleId = roles[0].id;
          // Generate default password (supplier should change this)
          const defaultPassword = "password123";
          const hashedPassword = await bcrypt.hash(defaultPassword, 10);

          await query(
            "INSERT INTO users (company_id, role_id, name, email, password) VALUES (?, ?, ?, ?, ?)",
            [newSupplierId, supplierRoleId, name, email, hashedPassword]
          );
        }
      }

      req.session.flash = {
        success:
          "Supplier created successfully with partnership and user account",
      };
      req.session.save((err) => {
        if (err) console.error("Session save error:", err);
        res.redirect("/suppliers");
      });
    } catch (error) {
      console.error("Supplier create error:", error);
      req.session.flash = {
        error: "Error creating supplier",
      };
      req.session.save((err) => {
        if (err) console.error("Session save error:", err);
        res.redirect("/suppliers/create");
      });
    }
  }
);

// Supplier detail
router.get("/suppliers/:id", requireAuth, async (req, res) => {
  try {
    const supplierId = req.params.id;
    const companyId = req.session.companyId;

    const suppliers = await query(
      "SELECT * FROM companies WHERE id = ? AND type = 'supplier'",
      [supplierId]
    );

    if (!suppliers || suppliers.length === 0) {
      return res.status(404).render("shared/error", {
        message: "Supplier not found",
        error: { status: 404, stack: "" },
      });
    }

    const supplier = suppliers[0];

    // Get partnership status
    const partnerships = await query(
      "SELECT * FROM company_partnerships WHERE target_company_id = ? AND source_company_id = ?",
      [supplierId, companyId]
    );
    const partnership = partnerships.length > 0 ? partnerships[0] : null;

    // Get RFQs where this supplier was invited
    const rfqHistory = await query(
      `SELECT r.id, r.name, r.status, p.name as project_name, rs.rfq_id
       FROM rfq_suppliers rs
       JOIN rfqs r ON rs.rfq_id = r.id
       JOIN projects p ON r.project_id = p.id
       WHERE rs.company_id = ? AND p.company_id = ?
       ORDER BY r.created_at DESC
       LIMIT 10`,
      [supplierId, companyId]
    );

    // Get quotes submitted by this supplier
    const quotes = await query(
      `SELECT q.id, q.status, r.name as rfq_name, p.name as project_name
       FROM quotes q
       JOIN rfqs r ON q.rfq_id = r.id
       JOIN projects p ON r.project_id = p.id
       WHERE q.company_id = ? AND p.company_id = ?
       ORDER BY q.created_at DESC
       LIMIT 10`,
      [supplierId, companyId]
    );

    res.render("suppliers/supplier-detail", {
      title: `${supplier.name} - FlowBuilder`,
      supplier,
      partnership,
      rfqHistory,
      quotes,
    });
  } catch (error) {
    console.error("Supplier detail error:", error);
    res.status(500).render("shared/error", {
      message: "Error loading supplier",
      error: { status: 500, stack: error.stack },
    });
  }
});

// Edit supplier form
router.get("/suppliers/:id/edit", requireAuth, async (req, res) => {
  try {
    const supplierId = req.params.id;

    const suppliers = await query(
      "SELECT * FROM companies WHERE id = ? AND type = 'supplier'",
      [supplierId]
    );

    if (!suppliers || suppliers.length === 0) {
      return res.status(404).render("shared/error", {
        message: "Supplier not found",
        error: { status: 404, stack: "" },
      });
    }

    const supplier = suppliers[0];

    res.render("suppliers/supplier-edit", {
      title: `Edit ${supplier.name} - FlowBuilder`,
      supplier,
    });
  } catch (error) {
    console.error("Supplier edit form error:", error);
    res.status(500).render("shared/error", {
      message: "Error loading supplier form",
      error: { status: 500, stack: error.stack },
    });
  }
});

// Update supplier API
router.post(
  "/suppliers/:id/update",
  requireAuth,
  validateSupplierUpdate,
  async (req, res) => {
    try {
      const supplierId = req.params.id;
      const { name, email, trade_specialty } = req.body;

      // Verify supplier exists
      const suppliers = await query(
        "SELECT * FROM companies WHERE id = ? AND type = 'supplier'",
        [supplierId]
      );

      if (!suppliers || suppliers.length === 0) {
        return res.status(404).render("shared/error", {
          message: "Supplier not found",
          error: { status: 404, stack: "" },
        });
      }

      await query(
        "UPDATE companies SET name = ?, email = ?, trade_specialty = ? WHERE id = ? AND type = 'supplier'",
        [name, email || null, trade_specialty || null, supplierId]
      );

      req.session.flash = {
        success: "Supplier updated successfully",
      };
      req.session.save((err) => {
        if (err) console.error("Session save error:", err);
        res.redirect(`/suppliers/${supplierId}`);
      });
    } catch (error) {
      console.error("Supplier update error:", error);
      req.session.flash = {
        error: "Error updating supplier",
      };
      req.session.save((err) => {
        if (err) console.error("Session save error:", err);
        res.redirect(`/suppliers/${req.params.id}/edit`);
      });
    }
  }
);

// Delete supplier API
router.post("/suppliers/:id/delete", requireAuth, async (req, res) => {
  try {
    const supplierId = req.params.id;

    // Verify supplier exists
    const suppliers = await query(
      "SELECT * FROM companies WHERE id = ? AND type = 'supplier'",
      [supplierId]
    );

    if (!suppliers || suppliers.length === 0) {
      return res.status(404).render("shared/error", {
        message: "Supplier not found",
        error: { status: 404, stack: "" },
      });
    }

    // Check if supplier has active quotes
    const activeQuotes = await query(
      `SELECT COUNT(*) as count FROM quotes q
       JOIN rfqs r ON q.rfq_id = r.id
       WHERE q.company_id = ? AND r.status != 'closed'`,
      [supplierId]
    );

    if (activeQuotes[0].count > 0) {
      req.session.flash = {
        error: "Cannot delete supplier: has active quotes",
      };
      req.session.save((err) => {
        if (err) console.error("Session save error:", err);
        res.redirect("/suppliers");
      });
      return;
    }

    // Delete supplier company (cascade will handle partnerships)
    await query("DELETE FROM companies WHERE id = ? AND type = 'supplier'", [
      supplierId,
    ]);

    req.session.flash = {
      success: "Supplier deleted successfully",
    };
    req.session.save((err) => {
      if (err) console.error("Session save error:", err);
      res.redirect("/suppliers");
    });
  } catch (error) {
    console.error("Supplier delete error:", error);
    req.session.flash = {
      error: "Error deleting supplier",
    };
    req.session.save((err) => {
      if (err) console.error("Session save error:", err);
      res.redirect("/suppliers");
    });
  }
});

// Add partnership
router.post("/suppliers/:id/partner", requireAuth, async (req, res) => {
  try {
    const supplierId = req.params.id;
    const companyId = req.session.companyId;
    const { notes } = req.body;

    // Check if partnership already exists
    const existing = await query(
      "SELECT * FROM company_partnerships WHERE source_company_id = ? AND target_company_id = ?",
      [companyId, supplierId]
    );

    if (existing && existing.length > 0) {
      req.session.flash = {
        error: "Partnership already exists",
      };
    } else {
      await query(
        "INSERT INTO company_partnerships (source_company_id, target_company_id, notes, status) VALUES (?, ?, ?, 'active')",
        [companyId, supplierId, notes || null]
      );

      req.session.flash = {
        success: "Partnership created successfully",
      };
    }

    req.session.save((err) => {
      if (err) console.error("Session save error:", err);
      res.redirect(`/suppliers/${supplierId}`);
    });
  } catch (error) {
    console.error("Partnership create error:", error);
    req.session.flash = {
      error: "Error creating partnership",
    };
    req.session.save((err) => {
      if (err) console.error("Session save error:", err);
      res.redirect(`/suppliers/${supplierId}`);
    });
  }
});

// Remove partnership
router.post("/suppliers/:id/unpartner", requireAuth, async (req, res) => {
  try {
    const supplierId = req.params.id;
    const companyId = req.session.companyId;

    await query(
      "DELETE FROM company_partnerships WHERE source_company_id = ? AND target_company_id = ?",
      [companyId, supplierId]
    );

    req.session.flash = {
      success: "Partnership removed successfully",
    };
    req.session.save((err) => {
      if (err) console.error("Session save error:", err);
      res.redirect(`/suppliers/${supplierId}`);
    });
  } catch (error) {
    console.error("Partnership remove error:", error);
    req.session.flash = {
      error: "Error removing partnership",
    };
    req.session.save((err) => {
      if (err) console.error("Session save error:", err);
      res.redirect(`/suppliers/${supplierId}`);
    });
  }
});

// Update partnership
router.post(
  "/suppliers/:id/partnership/update",
  requireAuth,
  async (req, res) => {
    try {
      const supplierId = req.params.id;
      const companyId = req.session.companyId;
      const { notes, status } = req.body;

      await query(
        "UPDATE company_partnerships SET notes = ?, status = ? WHERE source_company_id = ? AND target_company_id = ?",
        [notes || null, status, companyId, supplierId]
      );

      req.session.flash = {
        success: "Partnership updated successfully",
      };
      req.session.save((err) => {
        if (err) console.error("Session save error:", err);
        res.redirect(`/suppliers/${supplierId}`);
      });
    } catch (error) {
      console.error("Partnership update error:", error);
      req.session.flash = {
        error: "Error updating partnership",
      };
      req.session.save((err) => {
        if (err) console.error("Session save error:", err);
        res.redirect(`/suppliers/${supplierId}`);
      });
    }
  }
);

module.exports = router;
