const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middleware/auth");
const { query } = require("../config/database");
const {
  validateSupplierCreation,
  validateSupplierUpdate,
} = require("../middleware/validation");

// List all suppliers with search
router.get("/suppliers", requireAuth, async (req, res) => {
  try {
    const companyId = req.session.companyId;
    const { search, trade_specialty } = req.query;

    let sql = `
      SELECT s.*, 
        CASE WHEN cs.company_id IS NOT NULL THEN 'partnered' ELSE 'not_partnered' END as partnership_status,
        cs.status as partnership_status_detail,
        cs.notes as partnership_notes
      FROM suppliers s
      LEFT JOIN company_suppliers cs ON s.id = cs.supplier_id AND cs.company_id = ?
      WHERE s.company_id = ?
    `;
    const params = [companyId, companyId];

    if (search && search.trim()) {
      sql += " AND (s.name LIKE ? OR s.email LIKE ? OR s.trade_specialty LIKE ?)";
      const searchTerm = `%${search.trim()}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    if (trade_specialty && trade_specialty !== "all") {
      sql += " AND s.trade_specialty = ?";
      params.push(trade_specialty);
    }

    sql += " ORDER BY s.name ASC";

    const suppliers = await query(sql, params);

    // Get unique trade specialties for filter
    const specialties = await query(
      "SELECT DISTINCT trade_specialty FROM suppliers WHERE company_id = ? AND trade_specialty IS NOT NULL ORDER BY trade_specialty ASC",
      [companyId]
    );

    res.render("suppliers/suppliers", {
      title: "Suppliers Directory - FlowBuilder",
      suppliers,
      specialties,
      search: search || "",
      selectedSpecialty: trade_specialty || "all",
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
    res.render("suppliers/supplier-create", {
      title: "Create Supplier - FlowBuilder",
    });
  } catch (error) {
    console.error("Supplier create form error:", error);
    res.status(500).render("shared/error", {
      message: "Error loading supplier form",
      error: { status: 500, stack: error.stack },
    });
  }
});

// Create supplier API
router.post(
  "/suppliers",
  requireAuth,
  validateSupplierCreation,
  async (req, res) => {
    try {
      const companyId = req.session.companyId;
      const { name, email, trade_specialty } = req.body;

      await query(
        "INSERT INTO suppliers (company_id, name, email, trade_specialty) VALUES (?, ?, ?, ?)",
        [companyId, name, email || null, trade_specialty || null]
      );

      req.session.flash = {
        success: "Supplier created successfully",
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
      "SELECT * FROM suppliers WHERE id = ? AND company_id = ?",
      [supplierId, companyId]
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
      "SELECT * FROM company_suppliers WHERE supplier_id = ? AND company_id = ?",
      [supplierId, companyId]
    );
    const partnership = partnerships.length > 0 ? partnerships[0] : null;

    // Get RFQs where this supplier was invited
    const rfqHistory = await query(
      `SELECT r.id, r.name, r.status, p.name as project_name, rs.rfq_id
       FROM rfq_suppliers rs
       JOIN rfqs r ON rs.rfq_id = r.id
       JOIN projects p ON r.project_id = p.id
       WHERE rs.supplier_id = ? AND p.company_id = ?
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
       WHERE q.supplier_id = ? AND p.company_id = ?
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
    const companyId = req.session.companyId;

    const suppliers = await query(
      "SELECT * FROM suppliers WHERE id = ? AND company_id = ?",
      [supplierId, companyId]
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
      const companyId = req.session.companyId;
      const { name, email, trade_specialty } = req.body;

      // Verify supplier belongs to user's company
      const suppliers = await query(
        "SELECT * FROM suppliers WHERE id = ? AND company_id = ?",
        [supplierId, companyId]
      );

      if (!suppliers || suppliers.length === 0) {
        return res.status(404).render("shared/error", {
          message: "Supplier not found",
          error: { status: 404, stack: "" },
        });
      }

      await query(
        "UPDATE suppliers SET name = ?, email = ?, trade_specialty = ? WHERE id = ? AND company_id = ?",
        [name, email || null, trade_specialty || null, supplierId, companyId]
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
    const companyId = req.session.companyId;

    // Verify supplier belongs to user's company
    const suppliers = await query(
      "SELECT * FROM suppliers WHERE id = ? AND company_id = ?",
      [supplierId, companyId]
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
       WHERE q.supplier_id = ? AND r.status != 'closed'`,
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

    // Delete supplier (cascade will handle company_suppliers)
    await query("DELETE FROM suppliers WHERE id = ? AND company_id = ?", [
      supplierId,
      companyId,
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
      "SELECT * FROM company_suppliers WHERE company_id = ? AND supplier_id = ?",
      [companyId, supplierId]
    );

    if (existing && existing.length > 0) {
      req.session.flash = {
        error: "Partnership already exists",
      };
    } else {
      await query(
        "INSERT INTO company_suppliers (company_id, supplier_id, notes, status) VALUES (?, ?, ?, 'active')",
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
      "DELETE FROM company_suppliers WHERE company_id = ? AND supplier_id = ?",
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
router.post("/suppliers/:id/partnership/update", requireAuth, async (req, res) => {
  try {
    const supplierId = req.params.id;
    const companyId = req.session.companyId;
    const { notes, status } = req.body;

    await query(
      "UPDATE company_suppliers SET notes = ?, status = ? WHERE company_id = ? AND supplier_id = ?",
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
});

module.exports = router;

