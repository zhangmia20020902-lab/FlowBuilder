const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middleware/auth");
const { query } = require("../config/database");
const { validatePOStatusUpdate } = require("../middleware/validation");

// Helper function to create notification
async function createNotification(userId, type, referenceId, message) {
  try {
    await query(
      "INSERT INTO notifications (user_id, type, reference_id, message) VALUES (?, ?, ?, ?)",
      [userId, type, referenceId, message]
    );
  } catch (error) {
    console.error("Error creating notification:", error);
  }
}

// Helper function to notify relevant users about PO status change
async function notifyPOStatusChange(poId, newStatus, companyId) {
  try {
    // Get all users in the company (for now, notify all users)
    const users = await query("SELECT id FROM users WHERE company_id = ?", [
      companyId,
    ]);

    const message = `Purchase Order #${poId} status changed to ${newStatus}`;

    for (const user of users) {
      await createNotification(user.id, "po_status_updated", poId, message);
    }
  } catch (error) {
    console.error("Error notifying users:", error);
  }
}

// List all POs with filters
router.get("/pos", requireAuth, async (req, res) => {
  try {
    const companyId = req.session.companyId;
    const { status, project_id } = req.query;

    let sql = `
      SELECT po.*, 
        q.supplier_id, 
        s.name as supplier_name, 
        r.name as rfq_name, 
        p.name as project_name,
        p.id as project_id,
        u.name as created_by_name
      FROM pos po 
      JOIN quotes q ON po.quote_id = q.id 
      JOIN suppliers s ON q.supplier_id = s.id
      JOIN rfqs r ON q.rfq_id = r.id
      JOIN projects p ON r.project_id = p.id
      JOIN users u ON po.created_by = u.id
      WHERE p.company_id = ?
    `;
    const params = [companyId];

    if (status && status !== "all") {
      sql += " AND po.status = ?";
      params.push(status);
    }

    if (project_id && project_id !== "all") {
      sql += " AND p.id = ?";
      params.push(project_id);
    }

    sql += " ORDER BY po.created_at DESC";

    const pos = await query(sql, params);

    // Get all projects for filter dropdown
    const projects = await query(
      "SELECT id, name FROM projects WHERE company_id = ? ORDER BY name ASC",
      [companyId]
    );

    res.render("pos/pos-list", {
      title: "Purchase Orders - FlowBuilder",
      pos,
      projects,
      selectedStatus: status || "all",
      selectedProject: project_id || "all",
    });
  } catch (error) {
    console.error("POs list error:", error);
    res.status(500).render("shared/error", {
      message: "Error loading purchase orders",
      error: { status: 500, stack: error.stack },
    });
  }
});

// PO detail view
router.get("/pos/:id", requireAuth, async (req, res) => {
  try {
    const poId = req.params.id;
    const companyId = req.session.companyId;

    // Get PO with related data
    const pos = await query(
      `SELECT po.*, 
        q.id as quote_id,
        q.supplier_id, 
        q.duration,
        s.name as supplier_name,
        s.email as supplier_email,
        s.trade_specialty,
        r.id as rfq_id,
        r.name as rfq_name, 
        p.id as project_id,
        p.name as project_name,
        u.name as created_by_name
      FROM pos po 
      JOIN quotes q ON po.quote_id = q.id 
      JOIN suppliers s ON q.supplier_id = s.id
      JOIN rfqs r ON q.rfq_id = r.id
      JOIN projects p ON r.project_id = p.id
      JOIN users u ON po.created_by = u.id
      WHERE po.id = ? AND p.company_id = ?`,
      [poId, companyId]
    );

    if (!pos || pos.length === 0) {
      return res.status(404).render("shared/error", {
        message: "Purchase order not found",
        error: { status: 404, stack: "" },
      });
    }

    const po = pos[0];

    // Get quote items
    const quoteItems = await query(
      `SELECT qi.*, m.name as material_name, m.unit, m.sku
       FROM quote_items qi
       JOIN materials m ON qi.material_id = m.id
       WHERE qi.quote_id = ?`,
      [po.quote_id]
    );

    // Calculate total
    let total = 0;
    quoteItems.forEach((item) => {
      const itemTotal = parseFloat(item.price) * parseInt(item.quantity || 1);
      total += itemTotal;
    });

    res.render("pos/po-detail", {
      title: `PO #${po.id} - FlowBuilder`,
      po,
      quoteItems,
      total: total.toFixed(2),
    });
  } catch (error) {
    console.error("PO detail error:", error);
    res.status(500).render("shared/error", {
      message: "Error loading purchase order",
      error: { status: 500, stack: error.stack },
    });
  }
});

// Edit PO form
router.get("/pos/:id/edit", requireAuth, async (req, res) => {
  try {
    const poId = req.params.id;
    const companyId = req.session.companyId;

    const pos = await query(
      `SELECT po.*, p.name as project_name
       FROM pos po 
       JOIN quotes q ON po.quote_id = q.id 
       JOIN rfqs r ON q.rfq_id = r.id
       JOIN projects p ON r.project_id = p.id
       WHERE po.id = ? AND p.company_id = ?`,
      [poId, companyId]
    );

    if (!pos || pos.length === 0) {
      return res.status(404).render("shared/error", {
        message: "Purchase order not found",
        error: { status: 404, stack: "" },
      });
    }

    const po = pos[0];

    res.render("pos/po-edit", {
      title: `Edit PO #${po.id} - FlowBuilder`,
      po,
    });
  } catch (error) {
    console.error("PO edit form error:", error);
    res.status(500).render("shared/error", {
      message: "Error loading PO form",
      error: { status: 500, stack: error.stack },
    });
  }
});

// Update PO notes API
router.post("/pos/:id/update", requireAuth, async (req, res) => {
  try {
    const poId = req.params.id;
    const companyId = req.session.companyId;
    const { notes } = req.body;

    // Verify PO belongs to user's company
    const pos = await query(
      `SELECT po.* FROM pos po 
       JOIN quotes q ON po.quote_id = q.id 
       JOIN rfqs r ON q.rfq_id = r.id
       JOIN projects p ON r.project_id = p.id
       WHERE po.id = ? AND p.company_id = ?`,
      [poId, companyId]
    );

    if (!pos || pos.length === 0) {
      return res.status(404).render("shared/error", {
        message: "Purchase order not found",
        error: { status: 404, stack: "" },
      });
    }

    await query("UPDATE pos SET notes = ? WHERE id = ?", [
      notes || null,
      poId,
    ]);

    req.session.flash = {
      success: "PO updated successfully",
    };
    req.session.save((err) => {
      if (err) console.error("Session save error:", err);
      res.redirect(`/pos/${poId}`);
    });
  } catch (error) {
    console.error("PO update error:", error);
    req.session.flash = {
      error: "Error updating PO",
    };
    req.session.save((err) => {
      if (err) console.error("Session save error:", err);
      res.redirect(`/pos/${req.params.id}/edit`);
    });
  }
});

// Update PO status API
router.post(
  "/pos/:id/status",
  requireAuth,
  validatePOStatusUpdate,
  async (req, res) => {
    try {
      const poId = req.params.id;
      const companyId = req.session.companyId;
      const { status } = req.body;

      // Verify PO belongs to user's company
      const pos = await query(
        `SELECT po.* FROM pos po 
         JOIN quotes q ON po.quote_id = q.id 
         JOIN rfqs r ON q.rfq_id = r.id
         JOIN projects p ON r.project_id = p.id
         WHERE po.id = ? AND p.company_id = ?`,
        [poId, companyId]
      );

      if (!pos || pos.length === 0) {
        return res.status(404).render("shared/error", {
          message: "Purchase order not found",
          error: { status: 404, stack: "" },
        });
      }

      const currentStatus = pos[0].status;
      const validTransitions = {
        ordered: ["confirmed"],
        confirmed: ["shipped"],
        shipped: ["delivered"],
        delivered: [],
      };

      // Validate status transition
      if (!validTransitions[currentStatus].includes(status)) {
        req.session.flash = {
          error: `Cannot transition from ${currentStatus} to ${status}`,
        };
        req.session.save((err) => {
          if (err) console.error("Session save error:", err);
          res.redirect(`/pos/${poId}`);
        });
        return;
      }

      // Update status
      await query("UPDATE pos SET status = ? WHERE id = ?", [status, poId]);

      // Create notifications
      await notifyPOStatusChange(poId, status, companyId);

      req.session.flash = {
        success: `PO status updated to ${status}`,
      };
      req.session.save((err) => {
        if (err) console.error("Session save error:", err);
        res.redirect(`/pos/${poId}`);
      });
    } catch (error) {
      console.error("PO status update error:", error);
      req.session.flash = {
        error: "Error updating PO status",
      };
      req.session.save((err) => {
        if (err) console.error("Session save error:", err);
        res.redirect(`/pos/${req.params.id}`);
      });
    }
  }
);

// Cancel PO API
router.post("/pos/:id/cancel", requireAuth, async (req, res) => {
  try {
    const poId = req.params.id;
    const companyId = req.session.companyId;

    // Verify PO belongs to user's company
    const pos = await query(
      `SELECT po.* FROM pos po 
       JOIN quotes q ON po.quote_id = q.id 
       JOIN rfqs r ON q.rfq_id = r.id
       JOIN projects p ON r.project_id = p.id
       WHERE po.id = ? AND p.company_id = ?`,
      [poId, companyId]
    );

    if (!pos || pos.length === 0) {
      return res.status(404).render("shared/error", {
        message: "Purchase order not found",
        error: { status: 404, stack: "" },
      });
    }

    const currentStatus = pos[0].status;

    // Can only cancel if not delivered
    if (currentStatus === "delivered") {
      req.session.flash = {
        error: "Cannot cancel a delivered PO",
      };
      req.session.save((err) => {
        if (err) console.error("Session save error:", err);
        res.redirect(`/pos/${poId}`);
      });
      return;
    }

    // Set cancelled_at timestamp
    await query(
      "UPDATE pos SET status = 'cancelled', cancelled_at = NOW() WHERE id = ?",
      [poId]
    );

    // Create notifications
    await notifyPOStatusChange(poId, "cancelled", companyId);

    req.session.flash = {
      success: "PO cancelled successfully",
    };
    req.session.save((err) => {
      if (err) console.error("Session save error:", err);
      res.redirect(`/pos/${poId}`);
    });
  } catch (error) {
    console.error("PO cancel error:", error);
    req.session.flash = {
      error: "Error cancelling PO",
    };
    req.session.save((err) => {
      if (err) console.error("Session save error:", err);
      res.redirect(`/pos/${req.params.id}`);
    });
  }
});

// Notifications list
router.get("/notifications", requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;

    const notifications = await query(
      "SELECT * FROM notifications WHERE user_id = ? ORDER BY created_at DESC LIMIT 50",
      [userId]
    );

    res.render("pos/notifications", {
      title: "Notifications - FlowBuilder",
      notifications,
    });
  } catch (error) {
    console.error("Notifications list error:", error);
    res.status(500).render("shared/error", {
      message: "Error loading notifications",
      error: { status: 500, stack: error.stack },
    });
  }
});

// Mark notification as read
router.post("/notifications/:id/read", requireAuth, async (req, res) => {
  try {
    const notificationId = req.params.id;
    const userId = req.session.userId;

    // Verify notification belongs to user
    const notifications = await query(
      "SELECT * FROM notifications WHERE id = ? AND user_id = ?",
      [notificationId, userId]
    );

    if (!notifications || notifications.length === 0) {
      return res.status(404).json({ error: "Notification not found" });
    }

    await query("UPDATE notifications SET is_read = TRUE WHERE id = ?", [
      notificationId,
    ]);

    res.json({ success: true });
  } catch (error) {
    console.error("Notification mark read error:", error);
    res.status(500).json({ error: "Error marking notification as read" });
  }
});

// Mark all notifications as read
router.post("/notifications/read-all", requireAuth, async (req, res) => {
  try {
    const userId = req.session.userId;

    await query(
      "UPDATE notifications SET is_read = TRUE WHERE user_id = ? AND is_read = FALSE",
      [userId]
    );

    req.session.flash = {
      success: "All notifications marked as read",
    };
    req.session.save((err) => {
      if (err) console.error("Session save error:", err);
      res.redirect("/notifications");
    });
  } catch (error) {
    console.error("Mark all notifications read error:", error);
    req.session.flash = {
      error: "Error marking notifications as read",
    };
    req.session.save((err) => {
      if (err) console.error("Session save error:", err);
      res.redirect("/notifications");
    });
  }
});

module.exports = router;

