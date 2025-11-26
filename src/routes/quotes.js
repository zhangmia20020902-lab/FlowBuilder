const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middleware/auth");
const { query } = require("../config/database");
const {
  validateQuoteUpdate,
  validateQuoteSubmission,
} = require("../middleware/validation");
const logger = require("../config/logger");

// Manage quotes for a project
router.get("/projects/:id/quotes", requireAuth, async (req, res) => {
  try {
    const projectId = req.params.id;
    const companyId = req.session.companyId;
    const { status, rfq_id } = req.query;

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
    let sql = `SELECT q.*, q.rfq_id, r.name as rfq_name, s.name as supplier_name 
               FROM quotes q 
               JOIN rfqs r ON q.rfq_id = r.id 
               JOIN suppliers s ON q.supplier_id = s.id
               WHERE r.project_id = ?`;
    const params = [projectId];

    // Add status filter
    if (status && status !== "all") {
      sql += " AND q.status = ?";
      params.push(status);
    }

    // Add RFQ filter
    if (rfq_id && rfq_id !== "all") {
      sql += " AND q.rfq_id = ?";
      params.push(rfq_id);
    }

    sql += " ORDER BY q.created_at DESC";

    const quotes = await query(sql, params);

    // Get all RFQs for this project for filter dropdown
    const rfqs = await query(
      "SELECT id, name FROM rfqs WHERE project_id = ? ORDER BY name ASC",
      [projectId]
    );

    // Get status counts
    const statusCounts = await query(
      `SELECT q.status, COUNT(*) as count 
       FROM quotes q
       JOIN rfqs r ON q.rfq_id = r.id
       WHERE r.project_id = ? 
       GROUP BY q.status`,
      [projectId]
    );

    const statusCountsMap = {};
    statusCounts.forEach((sc) => {
      statusCountsMap[sc.status] = sc.count;
    });

    res.render("quotes/quotes-manage", {
      title: `Manage Quotes - ${project.name} - FlowBuilder`,
      project,
      quotes,
      rfqs,
      selectedStatus: status || "all",
      selectedRfqId: rfq_id || "all",
      statusCounts: statusCountsMap,
      resultCount: quotes.length,
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

// Submit quote form
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
router.post(
  "/rfqs/:id/quotes",
  requireAuth,
  validateQuoteSubmission,
  async (req, res) => {
    try {
      const rfqId = req.params.id;
      const { supplier_id, duration, items } = req.body;

      // Check RFQ exists and is open
      const rfqData = await query("SELECT * FROM rfqs WHERE id = ?", [rfqId]);

      if (!rfqData || rfqData.length === 0) {
        req.session.flash = { error: "RFQ not found" };
        return req.session.save((err) => {
          res.redirect("/dashboard");
        });
      }

      const rfq = rfqData[0];

      // Check RFQ status
      if (rfq.status !== "open") {
        req.session.flash = { error: "This RFQ is not accepting quotes" };
        return req.session.save((err) => {
          res.redirect("/dashboard");
        });
      }

      // Check if deadline passed
      if (new Date(rfq.deadline) < new Date()) {
        req.session.flash = { error: "RFQ deadline has passed" };
        return req.session.save((err) => {
          res.redirect("/dashboard");
        });
      }

      // Check for duplicate submission
      const existingQuotes = await query(
        "SELECT id FROM quotes WHERE rfq_id = ? AND supplier_id = ?",
        [rfqId, supplier_id]
      );

      if (existingQuotes.length > 0) {
        req.session.flash = {
          error: "You have already submitted a quote for this RFQ",
        };
        return req.session.save((err) => {
          res.redirect(`/rfqs/${rfqId}/submit-quote`);
        });
      }

      // Insert quote
      const result = await query(
        "INSERT INTO quotes (rfq_id, supplier_id, duration, status) VALUES (?, ?, ?, ?)",
        [rfqId, supplier_id, duration, "submitted"]
      );

      const quoteId = result.insertId;

      // Insert quote items
      const itemsArray =
        items && typeof items === "object"
          ? Object.values(items).filter(
              (item) => item.material_id && item.price && item.quantity
            )
          : [];

      if (itemsArray.length > 0) {
        for (const item of itemsArray) {
          await query(
            "INSERT INTO quote_items (quote_id, material_id, price, quantity, status) VALUES (?, ?, ?, ?, ?)",
            [quoteId, item.material_id, item.price, item.quantity, "pending"]
          );
        }
      }

      // Update supplier tracking status to 'submitted' and set responded_at
      await query(
        "UPDATE rfq_suppliers SET status = 'submitted', responded_at = NOW() WHERE rfq_id = ? AND supplier_id = ?",
        [rfqId, supplier_id]
      );

      const rfqs = await query("SELECT project_id FROM rfqs WHERE id = ?", [
        rfqId,
      ]);
      const projectId = rfqs[0].project_id;

      req.session.flash = { success: "Quote submitted successfully" };
      req.session.save((err) => {
        res.redirect(`/projects/${projectId}/quotes`);
      });
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
  }
);

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

// Update quote API - POST route (HTML forms can't send PUT)
router.post(
  "/quotes/:id/update",
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
        req.session.flash = { error: "Quote not found" };
        return req.session.save((err) => {
          res.redirect("/dashboard");
        });
      }

      const quote = quotes[0];

      // Only allow editing submitted or pending quotes
      if (quote.status === "awarded") {
        req.session.flash = {
          error: "Awarded quotes cannot be edited",
        };
        return req.session.save((err) => {
          res.redirect(`/projects/${quote.project_id}/quotes`);
        });
      }

      // Update quote
      await query("UPDATE quotes SET duration = ? WHERE id = ?", [
        duration,
        quoteId,
      ]);

      // Delete existing items and insert updated ones
      await query("DELETE FROM quote_items WHERE quote_id = ?", [quoteId]);

      // Fix: Convert items object to array
      const itemsArray =
        items && typeof items === "object"
          ? Object.values(items).filter(
              (item) => item.material_id && item.price && item.quantity
            )
          : [];

      if (itemsArray.length > 0) {
        for (const item of itemsArray) {
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
        res.redirect("/dashboard");
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
      "SELECT r.*, p.name as project_name, p.id as project_id FROM rfqs r JOIN projects p ON r.project_id = p.id WHERE r.id = ?",
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
      "SELECT q.*, s.name as supplier_name, s.email as supplier_email FROM quotes q JOIN suppliers s ON q.supplier_id = s.id WHERE q.rfq_id = ?",
      [rfq_id]
    );

    // Optimize: Get all items in single query to avoid N+1
    const quoteIds = quotes.map((q) => q.id);
    let allItems = [];
    if (quoteIds.length > 0) {
      allItems = await query(
        `SELECT qi.*, m.name as material_name, m.unit 
         FROM quote_items qi 
         JOIN materials m ON qi.material_id = m.id 
         WHERE qi.quote_id IN (${quoteIds.map(() => "?").join(",")})`,
        quoteIds
      );
    }

    // Group items by quote_id
    const itemsByQuote = {};
    allItems.forEach((item) => {
      if (!itemsByQuote[item.quote_id]) {
        itemsByQuote[item.quote_id] = [];
      }
      itemsByQuote[item.quote_id].push(item);
    });

    // Attach items to quotes and calculate totals
    quotes.forEach((quote) => {
      quote.items = itemsByQuote[quote.id] || [];
      quote.total = quote.items.reduce(
        (sum, item) => sum + parseFloat(item.price) * parseInt(item.quantity),
        0
      );
    });

    // Get all suppliers for this RFQ with their status
    const allSuppliers = await query(
      `SELECT s.id, s.name, s.email, s.trade_specialty,
              rs.status as tracking_status,
              rs.notified_at,
              rs.responded_at
       FROM rfq_suppliers rs
       JOIN suppliers s ON rs.supplier_id = s.id
       WHERE rs.rfq_id = ?
       ORDER BY s.name`,
      [rfq_id]
    );

    // Separate pending suppliers (those who haven't submitted)
    const pendingSuppliers = allSuppliers.filter(
      (supplier) => supplier.tracking_status === "pending"
    );

    // Calculate statistics
    const totalSuppliers = allSuppliers.length;
    const quotesReceived = quotes.length;
    const quotesPending = pendingSuppliers.length;
    const responseRate =
      totalSuppliers > 0
        ? Math.round((quotesReceived / totalSuppliers) * 100)
        : 0;

    // Calculate days until deadline
    const now = new Date();
    const deadline = new Date(rfq.deadline);
    const daysUntilDeadline = Math.ceil(
      (deadline - now) / (1000 * 60 * 60 * 24)
    );

    res.render("quotes/quote-compare", {
      title: `Compare Quotes - ${rfq.name} - FlowBuilder`,
      rfq,
      quotes,
      pendingSuppliers,
      totalSuppliers,
      quotesReceived,
      quotesPending,
      responseRate,
      daysUntilDeadline,
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

// Delete quote API - POST route (HTML forms can't send DELETE)
router.post("/quotes/:id/delete", requireAuth, async (req, res) => {
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
      req.session.flash = { error: "Quote not found" };
      return req.session.save((err) => {
        res.redirect("/dashboard");
      });
    }

    const quote = quotes[0];

    // Cannot delete awarded quotes
    if (quote.status === "awarded") {
      req.session.flash = {
        error: "Awarded quotes cannot be deleted",
      };
      return req.session.save((err) => {
        res.redirect(`/projects/${quote.project_id}/quotes`);
      });
    }

    // Delete quote (cascade will handle quote items)
    await query("DELETE FROM quotes WHERE id = ?", [quoteId]);

    req.session.flash = {
      success: "Quote deleted successfully",
    };
    req.session.save((err) => {
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
      res.redirect("/dashboard");
    });
  }
});

// Generate PO from quote
router.post("/quotes/:id/generate-po", requireAuth, async (req, res) => {
  try {
    const quoteId = req.params.id;
    const userId = req.session.userId;

    // Check if PO already exists for this quote
    const existingPos = await query("SELECT id FROM pos WHERE quote_id = ?", [
      quoteId,
    ]);

    if (existingPos.length > 0) {
      const quotes = await query(
        "SELECT r.project_id FROM quotes q JOIN rfqs r ON q.rfq_id = r.id WHERE q.id = ?",
        [quoteId]
      );
      req.session.flash = { error: "PO already exists for this quote" };
      return req.session.save((err) => {
        res.redirect(`/projects/${quotes[0].project_id}/quotes`);
      });
    }

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

    req.session.flash = { success: "Purchase Order created successfully" };
    req.session.save((err) => {
      res.redirect(`/projects/${projectId}/po-tracker`);
    });
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
