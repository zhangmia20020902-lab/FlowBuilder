const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middleware/auth");
const { query, getConnection } = require("../config/database");
const logger = require("../config/logger");
const {
  validateRFQCreation,
  validateRFQUpdate,
} = require("../middleware/validation");

// Manage RFQs for a project
router.get("/projects/:id/rfqs", requireAuth, async (req, res) => {
  try {
    const projectId = req.params.id;
    const companyId = req.session.companyId;
    const { search, status, sortBy } = req.query;

    const projects = await query(
      "SELECT * FROM projects WHERE id = ? AND company_id = ?",
      [projectId, companyId]
    );

    if (!projects || projects.length === 0) {
      return res.status(404).render("shared/error", {
        message: "Project not found",
        error: { status: 404, stack: "" },
      });
    }

    const project = projects[0];

    // Build dynamic SQL query
    let sql = "SELECT * FROM rfqs WHERE project_id = ?";
    const params = [projectId];

    // Add search filter
    if (search && search.trim()) {
      sql += " AND name LIKE ?";
      params.push(`%${search.trim()}%`);
    }

    // Add status filter
    if (status && status !== "all") {
      sql += " AND status = ?";
      params.push(status);
    }

    // Add sorting
    const validSortOptions = {
      newest: "created_at DESC",
      oldest: "created_at ASC",
      deadline: "deadline ASC",
      name: "name ASC",
    };

    const sortColumn = validSortOptions[sortBy] || "created_at DESC";
    sql += ` ORDER BY ${sortColumn}`;

    const rfqs = await query(sql, params);

    // Get status counts for filter badges
    const statusCounts = await query(
      `SELECT status, COUNT(*) as count 
       FROM rfqs 
       WHERE project_id = ? 
       GROUP BY status`,
      [projectId]
    );

    const statusCountsMap = {};
    statusCounts.forEach((sc) => {
      statusCountsMap[sc.status] = sc.count;
    });

    res.render("rfqs/rfqs-manage", {
      title: `Manage RFQs - ${project.name} - FlowBuilder`,
      project,
      rfqs,
      search: search || "",
      selectedStatus: status || "all",
      sortBy: sortBy || "newest",
      statusCounts: statusCountsMap,
      resultCount: rfqs.length,
    });
  } catch (error) {
    logger.error("RFQs manage error", {
      error: error.message,
      stack: error.stack,
      userId: req.session?.userId,
    });
    res.status(500).render("shared/error", {
      message: "Error loading RFQs",
      error: { status: 500, stack: error.stack },
    });
  }
});

// Create RFQ form
router.get("/projects/:id/rfqs/create", requireAuth, async (req, res) => {
  try {
    const projectId = req.params.id;
    const companyId = req.session.companyId;

    const projects = await query(
      "SELECT * FROM projects WHERE id = ? AND company_id = ?",
      [projectId, companyId]
    );

    if (!projects || projects.length === 0) {
      return res.status(404).render("shared/error", {
        message: "Project not found",
        error: { status: 404, stack: "" },
      });
    }

    const project = projects[0];

    // Get available materials
    const materials = await query(
      "SELECT * FROM materials WHERE company_id = ? ORDER BY category, name",
      [companyId]
    );

    // Get available suppliers
    const suppliers = await query(
      "SELECT s.* FROM suppliers s WHERE s.company_id = ? ORDER BY name",
      [companyId]
    );

    res.render("rfqs/rfq-create", {
      title: `Create RFQ - ${project.name} - FlowBuilder`,
      project,
      materials,
      suppliers,
    });
  } catch (error) {
    logger.error("RFQ create form error", {
      error: error.message,
      stack: error.stack,
      userId: req.session?.userId,
    });
    res.status(500).render("shared/error", {
      message: "Error loading RFQ form",
      error: { status: 500, stack: error.stack },
    });
  }
});

// Create RFQ API
router.post(
  "/projects/:id/rfqs",
  requireAuth,
  validateRFQCreation,
  async (req, res) => {
    try {
      const projectId = req.params.id;
      const userId = req.session.userId;
      const { name, deadline, materials, suppliers } = req.body;

      // Insert RFQ
      const result = await query(
        "INSERT INTO rfqs (project_id, name, deadline, status, created_by) VALUES (?, ?, ?, ?, ?)",
        [projectId, name, deadline, "draft", userId]
      );

      const rfqId = result.insertId;

      // Insert materials - parse from form object
      if (materials && typeof materials === "object") {
        const selectedMaterials = Object.keys(materials)
          .filter((id) => {
            // Only process materials that have the selected checkbox checked
            const materialId = parseInt(id);
            const hasSelected =
              materials[id].selected !== undefined &&
              materials[id].selected !== null &&
              materials[id].selected !== "";
            return !isNaN(materialId) && materialId > 0 && hasSelected;
          })
          .map((id) => {
            const materialId = parseInt(id);
            const quantity = parseInt(materials[id].quantity);
            return {
              id: materialId,
              quantity: isNaN(quantity) ? 0 : quantity,
            };
          })
          .filter((material) => material.id > 0 && material.quantity > 0);

        for (const material of selectedMaterials) {
          await query(
            "INSERT INTO rfq_materials (rfq_id, material_id, quantity) VALUES (?, ?, ?)",
            [rfqId, material.id, material.quantity]
          );
        }
      }

      // Insert suppliers
      if (suppliers && Array.isArray(suppliers)) {
        for (const supplierId of suppliers) {
          await query(
            "INSERT INTO rfq_suppliers (rfq_id, supplier_id) VALUES (?, ?)",
            [rfqId, supplierId]
          );
        }
      }

      res.redirect(`/projects/${projectId}/rfqs`);
    } catch (error) {
      logger.error("RFQ create error", {
        error: error.message,
        stack: error.stack,
        userId: req.session?.userId,
      });
      res.status(500).render("shared/error", {
        message: "Error creating RFQ",
        error: { status: 500, stack: error.stack },
      });
    }
  }
);

// View RFQ Detail
router.get("/rfqs/:id", requireAuth, async (req, res) => {
  try {
    const rfqId = req.params.id;
    const companyId = req.session.companyId;

    // Get RFQ with project info
    const rfqs = await query(
      `SELECT r.*, p.name as project_name, p.id as project_id, p.company_id,
              u.name as created_by_name
       FROM rfqs r 
       JOIN projects p ON r.project_id = p.id 
       LEFT JOIN users u ON r.created_by = u.id
       WHERE r.id = ? AND p.company_id = ?`,
      [rfqId, companyId]
    );

    if (!rfqs || rfqs.length === 0) {
      return res.status(404).render("shared/error", {
        message: "RFQ not found",
        error: { status: 404, stack: "" },
      });
    }

    const rfq = rfqs[0];

    // Get selected materials with quantities
    const selectedMaterials = await query(
      `SELECT rm.material_id, rm.quantity, m.name, m.category, m.unit 
       FROM rfq_materials rm 
       JOIN materials m ON rm.material_id = m.id 
       WHERE rm.rfq_id = ?
       ORDER BY m.category, m.name`,
      [rfqId]
    );

    // Get selected suppliers with tracking status
    const selectedSuppliers = await query(
      `SELECT s.id, s.name, s.trade_specialty, s.email,
              rs.status as tracking_status,
              rs.notified_at,
              rs.responded_at,
              q.id as quote_id,
              q.created_at as quote_submitted_at
       FROM suppliers s 
       JOIN rfq_suppliers rs ON s.id = rs.supplier_id 
       LEFT JOIN quotes q ON q.rfq_id = rs.rfq_id AND q.supplier_id = s.id
       WHERE rs.rfq_id = ?
       ORDER BY s.name`,
      [rfqId]
    );

    res.render("rfqs/rfq-detail", {
      title: `RFQ: ${rfq.name} - FlowBuilder`,
      rfq,
      selectedMaterials,
      selectedSuppliers,
    });
  } catch (error) {
    logger.error("RFQ detail error", {
      error: error.message,
      stack: error.stack,
      userId: req.session?.userId,
    });
    res.status(500).render("shared/error", {
      message: "Error loading RFQ details",
      error: { status: 500, stack: error.stack },
    });
  }
});

// Edit RFQ form
router.get("/rfqs/:id/edit", requireAuth, async (req, res) => {
  try {
    const rfqId = req.params.id;
    const companyId = req.session.companyId;

    // Get RFQ with project info
    const rfqs = await query(
      `SELECT r.*, p.name as project_name, p.company_id 
       FROM rfqs r 
       JOIN projects p ON r.project_id = p.id 
       WHERE r.id = ? AND p.company_id = ?`,
      [rfqId, companyId]
    );

    if (!rfqs || rfqs.length === 0) {
      return res.status(404).render("shared/error", {
        message: "RFQ not found",
        error: { status: 404, stack: "" },
      });
    }

    const rfq = rfqs[0];

    // Only allow editing draft RFQs
    if (rfq.status !== "draft") {
      req.session.flash = {
        error: "Only draft RFQs can be edited",
      };
      req.session.save((err) => {
        if (err) console.error("Session save error:", err);
        return res.redirect(`/projects/${rfq.project_id}/rfqs`);
      });
      return;
    }

    // Format deadline for datetime-local input (YYYY-MM-DDTHH:MM)
    if (rfq.deadline) {
      const deadlineDate = new Date(rfq.deadline);
      rfq.deadline = deadlineDate.toISOString().slice(0, 16);
    }

    // Get available materials
    const materials = await query(
      "SELECT * FROM materials WHERE company_id = ? ORDER BY category, name",
      [companyId]
    );

    // Get selected materials
    const selectedMaterials = await query(
      `SELECT rm.*, m.name, m.unit 
       FROM rfq_materials rm 
       JOIN materials m ON rm.material_id = m.id 
       WHERE rm.rfq_id = ?`,
      [rfqId]
    );

    // Get available suppliers
    const suppliers = await query(
      "SELECT s.* FROM suppliers s WHERE s.company_id = ? ORDER BY name",
      [companyId]
    );

    // Get selected suppliers
    const selectedSuppliers = await query(
      `SELECT rs.supplier_id, s.name 
       FROM rfq_suppliers rs 
       JOIN suppliers s ON rs.supplier_id = s.id 
       WHERE rs.rfq_id = ?`,
      [rfqId]
    );

    // Transform selectedMaterials to Map for O(1) lookup
    const selectedMaterialsMap = {};
    selectedMaterials.forEach((m) => {
      selectedMaterialsMap[m.material_id] = {
        quantity: m.quantity,
        material_id: m.material_id,
      };
    });

    // Transform selectedSuppliers to Set for O(1) lookup
    const selectedSuppliersSet = new Set(
      selectedSuppliers.map((s) => s.supplier_id)
    );

    res.render("rfqs/rfq-edit", {
      title: `Edit RFQ - ${rfq.name} - FlowBuilder`,
      rfq,
      materials,
      selectedMaterials,
      selectedMaterialsMap,
      suppliers,
      selectedSuppliers,
      selectedSuppliersSet: Array.from(selectedSuppliersSet),
    });
  } catch (error) {
    logger.error("RFQ edit form error", {
      error: error.message,
      stack: error.stack,
      userId: req.session?.userId,
    });
    res.status(500).render("shared/error", {
      message: "Error loading RFQ form",
      error: { status: 500, stack: error.stack },
    });
  }
});

// Update RFQ API
router.post(
  "/rfqs/:id/update",
  requireAuth,
  validateRFQUpdate,
  async (req, res) => {
    try {
      const rfqId = req.params.id;
      const companyId = req.session.companyId;
      const { name, deadline, materials, suppliers } = req.body;

      // Verify RFQ belongs to user's company and is in draft status
      const rfqs = await query(
        `SELECT r.*, p.company_id 
       FROM rfqs r 
       JOIN projects p ON r.project_id = p.id 
       WHERE r.id = ? AND p.company_id = ?`,
        [rfqId, companyId]
      );

      if (!rfqs || rfqs.length === 0) {
        return res.status(404).render("shared/error", {
          message: "RFQ not found",
          error: { status: 404, stack: "" },
        });
      }

      const rfq = rfqs[0];

      // Only allow editing draft RFQs
      if (rfq.status !== "draft") {
        req.session.flash = {
          error: "Only draft RFQs can be edited",
        };
        req.session.save((err) => {
          if (err) console.error("Session save error:", err);
          return res.redirect(`/projects/${rfq.project_id}/rfqs`);
        });
        return;
      }

      // Update RFQ
      await query("UPDATE rfqs SET name = ?, deadline = ? WHERE id = ?", [
        name,
        deadline,
        rfqId,
      ]);

      // Delete existing materials and suppliers
      await query("DELETE FROM rfq_materials WHERE rfq_id = ?", [rfqId]);
      await query("DELETE FROM rfq_suppliers WHERE rfq_id = ?", [rfqId]);

      // Insert updated materials - parse from form object
      if (materials && typeof materials === "object") {
        const selectedMaterials = Object.keys(materials)
          .filter((id) => {
            // Only process materials that have the selected checkbox checked
            const materialId = parseInt(id);
            const hasSelected =
              materials[id].selected !== undefined &&
              materials[id].selected !== null &&
              materials[id].selected !== "";
            return !isNaN(materialId) && materialId > 0 && hasSelected;
          })
          .map((id) => {
            const materialId = parseInt(id);
            const quantity = parseInt(materials[id].quantity);
            return {
              id: materialId,
              quantity: isNaN(quantity) ? 0 : quantity,
            };
          })
          .filter((material) => material.id > 0 && material.quantity > 0);

        for (const material of selectedMaterials) {
          await query(
            "INSERT INTO rfq_materials (rfq_id, material_id, quantity) VALUES (?, ?, ?)",
            [rfqId, material.id, material.quantity]
          );
        }
      }

      // Insert updated suppliers
      if (suppliers && Array.isArray(suppliers)) {
        for (const supplierId of suppliers) {
          await query(
            "INSERT INTO rfq_suppliers (rfq_id, supplier_id) VALUES (?, ?)",
            [rfqId, supplierId]
          );
        }
      }

      req.session.flash = {
        success: "RFQ updated successfully",
      };
      req.session.save((err) => {
        if (err) console.error("Session save error:", err);
        res.redirect(`/rfqs/${rfqId}`);
      });
    } catch (error) {
      logger.error("RFQ update error", {
        error: error.message,
        stack: error.stack,
        userId: req.session?.userId,
      });
      req.session.flash = {
        error: "Error updating RFQ",
      };
      req.session.save((err) => {
        if (err) console.error("Session save error:", err);
        res.redirect(`/rfqs/${req.params.id}/edit`);
      });
    }
  }
);

// Distribute RFQ page
router.get("/rfqs/:id/distribute", requireAuth, async (req, res) => {
  try {
    const rfqId = req.params.id;

    const rfqs = await query(
      "SELECT r.*, p.name as project_name FROM rfqs r JOIN projects p ON r.project_id = p.id WHERE r.id = ?",
      [rfqId]
    );

    if (!rfqs || rfqs.length === 0) {
      return res.status(404).render("shared/error", {
        message: "RFQ not found",
        error: { status: 404, stack: "" },
      });
    }

    const rfq = rfqs[0];

    // Get suppliers for this RFQ
    const suppliers = await query(
      "SELECT s.* FROM suppliers s JOIN rfq_suppliers rs ON s.id = rs.supplier_id WHERE rs.rfq_id = ?",
      [rfqId]
    );

    res.render("rfqs/rfq-distribute", {
      title: `Distribute RFQ - ${rfq.name} - FlowBuilder`,
      rfq,
      suppliers,
    });
  } catch (error) {
    logger.error("RFQ distribute error", {
      error: error.message,
      stack: error.stack,
      userId: req.session?.userId,
    });
    res.status(500).render("shared/error", {
      message: "Error loading distribution page",
      error: { status: 500, stack: error.stack },
    });
  }
});

// Delete RFQ API
router.post("/rfqs/:id/delete", requireAuth, async (req, res) => {
  try {
    const rfqId = req.params.id;
    const companyId = req.session.companyId;

    // Verify RFQ belongs to user's company and get status
    const rfqs = await query(
      `SELECT r.*, p.company_id, p.id as project_id 
       FROM rfqs r 
       JOIN projects p ON r.project_id = p.id 
       WHERE r.id = ? AND p.company_id = ?`,
      [rfqId, companyId]
    );

    if (!rfqs || rfqs.length === 0) {
      return res.status(404).render("shared/error", {
        message: "RFQ not found",
        error: { status: 404, stack: "" },
      });
    }

    const rfq = rfqs[0];

    // Only allow deleting draft RFQs
    if (rfq.status !== "draft") {
      req.session.flash = {
        error: "Only draft RFQs can be deleted",
      };
      req.session.save((err) => {
        if (err) console.error("Session save error:", err);
        return res.redirect(`/projects/${rfq.project_id}/rfqs`);
      });
      return;
    }

    // Delete RFQ (cascade will handle materials and suppliers)
    await query("DELETE FROM rfqs WHERE id = ?", [rfqId]);

    req.session.flash = {
      success: "RFQ deleted successfully",
    };
    req.session.save((err) => {
      if (err) console.error("Session save error:", err);
      res.redirect(`/projects/${rfq.project_id}/rfqs`);
    });
  } catch (error) {
    logger.error("RFQ delete error", {
      error: error.message,
      stack: error.stack,
      userId: req.session?.userId,
    });
    req.session.flash = {
      error: "Error deleting RFQ",
    };
    req.session.save((err) => {
      if (err) console.error("Session save error:", err);
      res.redirect("/projects");
    });
  }
});

// Send RFQ to suppliers API
router.post("/rfqs/:id/distribute", requireAuth, async (req, res) => {
  try {
    const rfqId = req.params.id;
    const companyId = req.session.companyId;

    // Verify RFQ belongs to user's company and is in draft status
    const rfqs = await query(
      `SELECT r.*, p.company_id 
       FROM rfqs r 
       JOIN projects p ON r.project_id = p.id 
       WHERE r.id = ? AND p.company_id = ?`,
      [rfqId, companyId]
    );

    if (!rfqs || rfqs.length === 0) {
      return res.status(404).render("shared/error", {
        message: "RFQ not found",
        error: { status: 404, stack: "" },
      });
    }

    const rfq = rfqs[0];

    // Only allow distributing draft RFQs
    if (rfq.status !== "draft") {
      req.session.flash = {
        error: "Only draft RFQs can be distributed",
      };
      req.session.save((err) => {
        if (err) console.error("Session save error:", err);
        return res.redirect(`/rfqs/${rfqId}`);
      });
      return;
    }

    // Check if RFQ has materials and suppliers
    const materials = await query(
      "SELECT COUNT(*) as count FROM rfq_materials WHERE rfq_id = ?",
      [rfqId]
    );
    const suppliers = await query(
      "SELECT COUNT(*) as count FROM rfq_suppliers WHERE rfq_id = ?",
      [rfqId]
    );

    if (materials[0].count === 0 || suppliers[0].count === 0) {
      req.session.flash = {
        error:
          "Cannot distribute RFQ without materials and suppliers. Please edit the RFQ first.",
      };
      req.session.save((err) => {
        if (err) console.error("Session save error:", err);
        return res.redirect(`/rfqs/${rfqId}`);
      });
      return;
    }

    // Update RFQ status to open
    await query("UPDATE rfqs SET status = ? WHERE id = ?", ["open", rfqId]);

    // Update supplier tracking status to 'pending' and set notified_at
    await query(
      "UPDATE rfq_suppliers SET status = 'pending', notified_at = NOW() WHERE rfq_id = ?",
      [rfqId]
    );

    // Log distribution
    logger.info("RFQ distributed", {
      rfqId,
      rfqName: rfq.name,
      suppliersCount: suppliers[0].count,
      materialsCount: materials[0].count,
      userId: req.session.userId,
    });

    // In a real system, send emails to suppliers here

    req.session.flash = {
      success: `RFQ distributed successfully to ${suppliers[0].count} supplier(s)`,
    };
    req.session.save((err) => {
      if (err) console.error("Session save error:", err);
      res.redirect(`/rfqs/${rfqId}`);
    });
  } catch (error) {
    logger.error("RFQ distribute error", {
      error: error.message,
      stack: error.stack,
      userId: req.session?.userId,
    });
    res.status(500).render("shared/error", {
      message: "Error distributing RFQ",
      error: { status: 500, stack: error.stack },
    });
  }
});

// Close RFQ API
router.post("/rfqs/:id/close", requireAuth, async (req, res) => {
  try {
    const rfqId = req.params.id;
    const companyId = req.session.companyId;

    // Verify RFQ belongs to user's company
    const rfqs = await query(
      `SELECT r.*, p.company_id, p.id as project_id 
       FROM rfqs r 
       JOIN projects p ON r.project_id = p.id 
       WHERE r.id = ? AND p.company_id = ?`,
      [rfqId, companyId]
    );

    if (!rfqs || rfqs.length === 0) {
      return res.status(404).render("shared/error", {
        message: "RFQ not found",
        error: { status: 404, stack: "" },
      });
    }

    const rfq = rfqs[0];

    // Only allow closing open RFQs
    if (rfq.status !== "open") {
      req.session.flash = {
        error: "Only open RFQs can be closed",
      };
      req.session.save((err) => {
        if (err) console.error("Session save error:", err);
        return res.redirect(`/rfqs/${rfqId}`);
      });
      return;
    }

    // Close the RFQ
    await query("UPDATE rfqs SET status = 'closed' WHERE id = ?", [rfqId]);

    logger.info("RFQ closed", {
      rfqId,
      rfqName: rfq.name,
      userId: req.session.userId,
    });

    req.session.flash = {
      success: "RFQ closed successfully",
    };
    req.session.save((err) => {
      if (err) console.error("Session save error:", err);
      res.redirect(`/rfqs/${rfqId}`);
    });
  } catch (error) {
    logger.error("RFQ close error", {
      error: error.message,
      stack: error.stack,
      userId: req.session?.userId,
    });
    req.session.flash = {
      error: "Error closing RFQ",
    };
    req.session.save((err) => {
      if (err) console.error("Session save error:", err);
      res.redirect(`/rfqs/${req.params.id}`);
    });
  }
});

// Get supplier status for an RFQ
router.get("/rfqs/:id/suppliers-status", requireAuth, async (req, res) => {
  try {
    const rfqId = req.params.id;
    const companyId = req.session.companyId;

    // Verify RFQ belongs to user's company
    const rfqs = await query(
      `SELECT r.* 
       FROM rfqs r 
       JOIN projects p ON r.project_id = p.id 
       WHERE r.id = ? AND p.company_id = ?`,
      [rfqId, companyId]
    );

    if (!rfqs || rfqs.length === 0) {
      return res.status(404).json({ error: "RFQ not found" });
    }

    // Get supplier status with quote information
    const supplierStatus = await query(
      `SELECT 
        s.id as supplier_id,
        s.name as supplier_name,
        s.email,
        s.trade_specialty,
        rs.status,
        rs.notified_at,
        rs.responded_at,
        q.id as quote_id,
        q.created_at as quote_submitted_at
       FROM rfq_suppliers rs
       JOIN suppliers s ON rs.supplier_id = s.id
       LEFT JOIN quotes q ON q.rfq_id = rs.rfq_id AND q.supplier_id = s.id
       WHERE rs.rfq_id = ?
       ORDER BY s.name`,
      [rfqId]
    );

    res.json({
      success: true,
      suppliers: supplierStatus,
    });
  } catch (error) {
    logger.error("Get supplier status error", {
      error: error.message,
      stack: error.stack,
      userId: req.session?.userId,
    });
    res.status(500).json({ error: "Error fetching supplier status" });
  }
});

module.exports = router;
