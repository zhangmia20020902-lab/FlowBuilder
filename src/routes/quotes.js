const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middleware/auth");
const { query } = require("../config/database");
const { validateQuoteUpdate } = require("../middleware/validation");
const logger = require("../config/logger");

// Manage quotes for a project
router.get("/projects/:id/quotes", requireAuth, async (req, res) => {
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

    // Get all quotes for RFQs in this project
    const quotes = await query(
      `SELECT q.*, r.name as rfq_name, s.name as supplier_name 
       FROM quotes q 
       JOIN rfqs r ON q.rfq_id = r.id 
       JOIN suppliers s ON q.supplier_id = s.id
       WHERE r.project_id = ? 
       ORDER BY q.created_at DESC`,
      [projectId]
    );

    res.render("quotes/quotes-manage", {
      title: `Manage Quotes - ${project.name} - FlowBuilder`,
      project,
      quotes,
    });
  } catch (error) {
    logger.error("Quotes manage error", {
      error: error.message,
      stack: error.stack,
      userId: req.session?.userId,
    });
    res.status(500).render("shared/error", {
      message: "Error loading quotes",
      error: { status: 500, stack: error.stack },
    });
  }
});

// Submit quote form (supplier view)
router.get("/rfqs/:id/submit-quote", requireAuth, async (req, res) => {
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

    // Get materials for this RFQ
    const materials = await query(
      "SELECT m.*, rm.quantity FROM materials m JOIN rfq_materials rm ON m.id = rm.material_id WHERE rm.rfq_id = ?",
      [rfqId]
    );

    res.render("quotes/quote-submit", {
      title: `Submit Quote - ${rfq.name} - FlowBuilder`,
      rfq,
      materials,
    });
  } catch (error) {
    logger.error("Quote submit form error", {
      error: error.message,
      stack: error.stack,
      userId: req.session?.userId,
    });
    res.status(500).render("shared/error", {
      message: "Error loading quote form",
      error: { status: 500, stack: error.stack },
    });
  }
});

// Submit quote API
router.post("/rfqs/:id/quotes", requireAuth, async (req, res) => {
  try {
    const rfqId = req.params.id;
    const { supplier_id, duration, items } = req.body;

    // Insert quote
    const result = await query(
      "INSERT INTO quotes (rfq_id, supplier_id, duration, status) VALUES (?, ?, ?, ?)",
      [rfqId, supplier_id, duration, "submitted"]
    );

    const quoteId = result.insertId;

    // Insert quote items
    if (items && Array.isArray(items)) {
      for (const item of items) {
        await query(
          "INSERT INTO quote_items (quote_id, material_id, price, quantity, status) VALUES (?, ?, ?, ?, ?)",
          [quoteId, item.material_id, item.price, item.quantity, "pending"]
        );
      }
    }

    const rfqs = await query("SELECT project_id FROM rfqs WHERE id = ?", [
      rfqId,
    ]);
    const projectId = rfqs[0].project_id;

    res.redirect(`/projects/${projectId}/quotes`);
  } catch (error) {
    logger.error("Quote submit error", {
      error: error.message,
      stack: error.stack,
      userId: req.session?.userId,
    });
    res.status(500).render("shared/error", {
      message: "Error submitting quote",
      error: { status: 500, stack: error.stack },
    });
  }
});

// Edit quote form
router.get("/quotes/:id/edit", requireAuth, async (req, res) => {
  try {
    const quoteId = req.params.id;
    const companyId = req.session.companyId;

    // Get quote with RFQ and project info
    const quotes = await query(
      `SELECT q.*, r.name as rfq_name, r.project_id, p.company_id, s.name as supplier_name
       FROM quotes q
       JOIN rfqs r ON q.rfq_id = r.id
       JOIN projects p ON r.project_id = p.id
       JOIN suppliers s ON q.supplier_id = s.id
       WHERE q.id = ? AND p.company_id = ?`,
      [quoteId, companyId]
    );

    if (!quotes || quotes.length === 0) {
      return res.status(404).render("shared/error", {
        message: "Quote not found",
        error: { status: 404, stack: "" },
      });
    }

    const quote = quotes[0];

    // Only allow editing submitted or pending quotes
    if (quote.status === "awarded") {
      req.session.flash = {
        error: "Awarded quotes cannot be edited",
      };
      req.session.save((err) => {
        if (err) console.error("Session save error:", err);
        return res.redirect(`/projects/${quote.project_id}/quotes`);
      });
      return;
    }

    // Get materials for this RFQ
    const materials = await query(
      "SELECT m.*, rm.quantity FROM materials m JOIN rfq_materials rm ON m.id = rm.material_id WHERE rm.rfq_id = ?",
      [quote.rfq_id]
    );

    // Get existing quote items
    const quoteItems = await query(
      "SELECT * FROM quote_items WHERE quote_id = ?",
      [quoteId]
    );

    res.render("quotes/quote-edit", {
      title: `Edit Quote - ${quote.rfq_name} - FlowBuilder`,
      quote,
      materials,
      quoteItems,
    });
  } catch (error) {
    logger.error("Quote edit form error", {
      error: error.message,
      stack: error.stack,
      userId: req.session?.userId,
    });
    res.status(500).render("shared/error", {
      message: "Error loading quote form",
      error: { status: 500, stack: error.stack },
    });
  }
});

// Update quote API
router.put(
  "/quotes/:id",
  requireAuth,
  validateQuoteUpdate,
  async (req, res) => {
    try {
      const quoteId = req.params.id;
      const companyId = req.session.companyId;
      const { duration, items } = req.body;

      // Verify quote belongs to user's company
      const quotes = await query(
        `SELECT q.*, r.project_id, p.company_id
       FROM quotes q
       JOIN rfqs r ON q.rfq_id = r.id
       JOIN projects p ON r.project_id = p.id
       WHERE q.id = ? AND p.company_id = ?`,
        [quoteId, companyId]
      );

      if (!quotes || quotes.length === 0) {
        return res.status(404).render("shared/error", {
          message: "Quote not found",
          error: { status: 404, stack: "" },
        });
      }

      const quote = quotes[0];

      // Only allow editing submitted or pending quotes
      if (quote.status === "awarded") {
        req.session.flash = {
          error: "Awarded quotes cannot be edited",
        };
        req.session.save((err) => {
          if (err) console.error("Session save error:", err);
          return res.redirect(`/projects/${quote.project_id}/quotes`);
        });
        return;
      }

      // Update quote
      await query("UPDATE quotes SET duration = ? WHERE id = ?", [
        duration,
        quoteId,
      ]);

      // Delete existing items and insert updated ones
      await query("DELETE FROM quote_items WHERE quote_id = ?", [quoteId]);

      if (items && Array.isArray(items)) {
        for (const item of items) {
          await query(
            "INSERT INTO quote_items (quote_id, material_id, price, quantity, status) VALUES (?, ?, ?, ?, ?)",
            [quoteId, item.material_id, item.price, item.quantity, "pending"]
          );
        }
      }

      req.session.flash = {
        success: "Quote updated successfully",
      };
      req.session.save((err) => {
        if (err) console.error("Session save error:", err);
        res.redirect(`/projects/${quote.project_id}/quotes`);
      });
    } catch (error) {
      logger.error("Quote update error", {
        error: error.message,
        stack: error.stack,
        userId: req.session?.userId,
      });
      req.session.flash = {
        error: "Error updating quote",
      };
      req.session.save((err) => {
        if (err) console.error("Session save error:", err);
        res.redirect(`/quotes/${req.params.id}/edit`);
      });
    }
  }
);

// Compare quotes
router.get("/quotes/compare", requireAuth, async (req, res) => {
  try {
    const { rfq_id } = req.query;

    if (!rfq_id) {
      return res.status(400).render("shared/error", {
        message: "RFQ ID is required",
        error: { status: 400, stack: "" },
      });
    }

    const rfqs = await query(
      "SELECT r.*, p.name as project_name FROM rfqs r JOIN projects p ON r.project_id = p.id WHERE r.id = ?",
      [rfq_id]
    );

    if (!rfqs || rfqs.length === 0) {
      return res.status(404).render("shared/error", {
        message: "RFQ not found",
        error: { status: 404, stack: "" },
      });
    }

    const rfq = rfqs[0];

    // Get all quotes for this RFQ
    const quotes = await query(
      "SELECT q.*, s.name as supplier_name FROM quotes q JOIN suppliers s ON q.supplier_id = s.id WHERE q.rfq_id = ?",
      [rfq_id]
    );

    // Get quote items for each quote
    for (const quote of quotes) {
      quote.items = await query(
        "SELECT qi.*, m.name as material_name, m.unit FROM quote_items qi JOIN materials m ON qi.material_id = m.id WHERE qi.quote_id = ?",
        [quote.id]
      );

      // Calculate total
      quote.total = quote.items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0
      );
    }

    res.render("quotes/quote-compare", {
      title: `Compare Quotes - ${rfq.name} - FlowBuilder`,
      rfq,
      quotes,
    });
  } catch (error) {
    logger.error("Quote compare error", {
      error: error.message,
      stack: error.stack,
      userId: req.session?.userId,
    });
    res.status(500).render("shared/error", {
      message: "Error comparing quotes",
      error: { status: 500, stack: error.stack },
    });
  }
});

// Delete quote API
router.delete("/quotes/:id", requireAuth, async (req, res) => {
  try {
    const quoteId = req.params.id;
    const companyId = req.session.companyId;

    // Verify quote belongs to user's company and get status
    const quotes = await query(
      `SELECT q.*, r.project_id, p.company_id
       FROM quotes q
       JOIN rfqs r ON q.rfq_id = r.id
       JOIN projects p ON r.project_id = p.id
       WHERE q.id = ? AND p.company_id = ?`,
      [quoteId, companyId]
    );

    if (!quotes || quotes.length === 0) {
      return res.status(404).render("shared/error", {
        message: "Quote not found",
        error: { status: 404, stack: "" },
      });
    }

    const quote = quotes[0];

    // Cannot delete awarded quotes
    if (quote.status === "awarded") {
      req.session.flash = {
        error: "Awarded quotes cannot be deleted",
      };
      req.session.save((err) => {
        if (err) console.error("Session save error:", err);
        return res.redirect(`/projects/${quote.project_id}/quotes`);
      });
      return;
    }

    // Delete quote (cascade will handle quote items)
    await query("DELETE FROM quotes WHERE id = ?", [quoteId]);

    req.session.flash = {
      success: "Quote deleted successfully",
    };
    req.session.save((err) => {
      if (err) console.error("Session save error:", err);
      res.redirect(`/projects/${quote.project_id}/quotes`);
    });
  } catch (error) {
    logger.error("Quote delete error", {
      error: error.message,
      stack: error.stack,
      userId: req.session?.userId,
    });
    req.session.flash = {
      error: "Error deleting quote",
    };
    req.session.save((err) => {
      if (err) console.error("Session save error:", err);
      res.redirect("/projects");
    });
  }
});

// Generate PO from quote
router.post("/quotes/:id/generate-po", requireAuth, async (req, res) => {
  try {
    const quoteId = req.params.id;
    const userId = req.session.userId;

    // Insert PO
    const result = await query(
      "INSERT INTO pos (quote_id, status, created_by) VALUES (?, ?, ?)",
      [quoteId, "ordered", userId]
    );

    // Update quote status to awarded
    await query("UPDATE quotes SET status = ? WHERE id = ?", [
      "awarded",
      quoteId,
    ]);

    // Get project ID for redirect
    const quotes = await query(
      "SELECT r.project_id FROM quotes q JOIN rfqs r ON q.rfq_id = r.id WHERE q.id = ?",
      [quoteId]
    );

    const projectId = quotes[0].project_id;

    res.redirect(`/projects/${projectId}/po-tracker`);
  } catch (error) {
    logger.error("Generate PO error", {
      error: error.message,
      stack: error.stack,
      userId: req.session?.userId,
    });
    res.status(500).render("shared/error", {
      message: "Error generating PO",
      error: { status: 500, stack: error.stack },
    });
  }
});

module.exports = router;
