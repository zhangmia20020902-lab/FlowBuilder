const express = require("express");
const router = express.Router();
const { requireAuth, requireRole } = require("../middleware/auth");
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
    const { status, rfq_id, page: pageParam } = req.query;

    // Pagination settings
    const itemsPerPage = 10;
    const page = Math.max(1, parseInt(pageParam) || 1);
    const offset = (page - 1) * itemsPerPage;

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
    let sql = `SELECT q.*, q.rfq_id, r.name as rfq_name, c.name as supplier_name 
               FROM quotes q 
               JOIN rfqs r ON q.rfq_id = r.id 
               JOIN companies c ON q.company_id = c.id
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

    // Count total items for pagination (using same WHERE conditions)
    let countSql = `SELECT COUNT(*) as total 
                    FROM quotes q 
                    JOIN rfqs r ON q.rfq_id = r.id 
                    WHERE r.project_id = ?`;
    const countParams = [projectId];

    if (status && status !== "all") {
      countSql += " AND q.status = ?";
      countParams.push(status);
    }

    if (rfq_id && rfq_id !== "all") {
      countSql += " AND q.rfq_id = ?";
      countParams.push(rfq_id);
    }

    const countResult = await query(countSql, countParams);
    const totalItems = countResult[0].total;
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    // Add sorting and pagination to main query
    sql += ` ORDER BY q.created_at DESC LIMIT ${itemsPerPage} OFFSET ${offset}`;

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

    res.render("quotes/quotes-manage", {
      title: `Manage Quotes - ${project.name} - FlowBuilder`,
      project,
      quotes,
      rfqs,
      selectedStatus: status || "all",
      selectedRfqId: rfq_id || "all",
      statusCounts: statusCountsMap,
      resultCount: quotes.length,
      pagination,
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

// List RFQs for suppliers to quote
router.get(
  "/supplier/rfqs",
  requireAuth,
  requireRole("Supplier"),
  async (req, res) => {
    try {
      const companyId = req.session.companyId;
      const { status } = req.query;

      // Pagination settings
      const itemsPerPage = 10;
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const offset = (page - 1) * itemsPerPage;

      // Build SQL to get RFQs where this supplier is invited
      let sql = `
      SELECT r.*, p.name as project_name, c.name as client_name,
             rs.status as supplier_status, rs.notified_at,
             (SELECT COUNT(*) FROM quotes q WHERE q.rfq_id = r.id AND q.company_id = ?) as has_quote
      FROM rfqs r
      JOIN rfq_suppliers rs ON r.id = rs.rfq_id
      JOIN projects p ON r.project_id = p.id
      JOIN companies c ON p.company_id = c.id
      WHERE rs.company_id = ? AND r.status = 'open'
    `;
      const params = [companyId, companyId];

      // Add status filter
      if (status && status !== "all") {
        if (status === "pending") {
          sql += " AND rs.status = 'pending'";
        } else if (status === "submitted") {
          sql += " AND rs.status = 'submitted'";
        }
      }

      // Count total items for pagination
      let countSql = `
      SELECT COUNT(*) as total
      FROM rfqs r
      JOIN rfq_suppliers rs ON r.id = rs.rfq_id
      WHERE rs.company_id = ? AND r.status = 'open'
    `;
      const countParams = [companyId];

      if (status && status !== "all") {
        if (status === "pending") {
          countSql += " AND rs.status = 'pending'";
        } else if (status === "submitted") {
          countSql += " AND rs.status = 'submitted'";
        }
      }

      const countResult = await query(countSql, countParams);
      const totalItems = countResult[0].total;
      const totalPages = Math.ceil(totalItems / itemsPerPage);

      // Add sorting and pagination
      sql += ` ORDER BY r.deadline ASC LIMIT ${itemsPerPage} OFFSET ${offset}`;

      const rfqs = await query(sql, params);

      // Get status counts
      const statusCounts = await query(
        `SELECT rs.status, COUNT(*) as count 
       FROM rfq_suppliers rs
       JOIN rfqs r ON rs.rfq_id = r.id
       WHERE rs.company_id = ? AND r.status = 'open'
       GROUP BY rs.status`,
        [companyId]
      );

      const statusCountsMap = {};
      statusCounts.forEach((sc) => {
        statusCountsMap[sc.status] = sc.count;
      });

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

      for (let i = startPage; i <= endPage; i++) {
        pagination.pages.push({
          number: i,
          isActive: i === page,
        });
      }

      res.render("quotes/supplier-rfqs", {
        title: "My RFQs - FlowBuilder",
        rfqs,
        selectedStatus: status || "all",
        statusCounts: statusCountsMap,
        pagination,
      });
    } catch (error) {
      logger.error("Supplier RFQs error", {
        error: error.message,
        stack: error.stack,
        userId: req.session?.userId,
      });
      res.status(500).render("shared/error", {
        message: "Error loading RFQs",
        error: { status: 500, stack: error.stack },
      });
    }
  }
);

// List supplier's submitted quotes
router.get(
  "/supplier/quotes",
  requireAuth,
  requireRole("Supplier"),
  async (req, res) => {
    try {
      const companyId = req.session.companyId;
      const { status } = req.query;

      // Pagination settings
      const itemsPerPage = 10;
      const page = Math.max(1, parseInt(req.query.page) || 1);
      const offset = (page - 1) * itemsPerPage;

      // Build SQL to get quotes submitted by this supplier
      let sql = `
      SELECT q.*, r.name as rfq_name, r.deadline, p.name as project_name, c.name as client_name
      FROM quotes q
      JOIN rfqs r ON q.rfq_id = r.id
      JOIN projects p ON r.project_id = p.id
      JOIN companies c ON p.company_id = c.id
      WHERE q.company_id = ?
    `;
      const params = [companyId];

      // Add status filter
      if (status && status !== "all") {
        sql += " AND q.status = ?";
        params.push(status);
      }

      // Count total items for pagination
      let countSql = `
      SELECT COUNT(*) as total
      FROM quotes q
      WHERE q.company_id = ?
    `;
      const countParams = [companyId];

      if (status && status !== "all") {
        countSql += " AND q.status = ?";
        countParams.push(status);
      }

      const countResult = await query(countSql, countParams);
      const totalItems = countResult[0].total;
      const totalPages = Math.ceil(totalItems / itemsPerPage);

      // Add sorting and pagination
      sql += ` ORDER BY q.created_at DESC LIMIT ${itemsPerPage} OFFSET ${offset}`;

      const quotes = await query(sql, params);

      // Get status counts
      const statusCounts = await query(
        `SELECT status, COUNT(*) as count 
       FROM quotes
       WHERE company_id = ?
       GROUP BY status`,
        [companyId]
      );

      const statusCountsMap = {};
      statusCounts.forEach((sc) => {
        statusCountsMap[sc.status] = sc.count;
      });

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

      for (let i = startPage; i <= endPage; i++) {
        pagination.pages.push({
          number: i,
          isActive: i === page,
        });
      }

      res.render("quotes/supplier-quotes", {
        title: "My Quotes - FlowBuilder",
        quotes,
        selectedStatus: status || "all",
        statusCounts: statusCountsMap,
        pagination,
      });
    } catch (error) {
      logger.error("Supplier quotes error", {
        error: error.message,
        stack: error.stack,
        userId: req.session?.userId,
      });
      res.status(500).render("shared/error", {
        message: "Error loading quotes",
        error: { status: 500, stack: error.stack },
      });
    }
  }
);

// Submit quote form - Only for suppliers who are invited to the RFQ
router.get(
  "/rfqs/:id/submit-quote",
  requireAuth,
  requireRole("Supplier"),
  async (req, res) => {
    try {
      const rfqId = req.params.id;
      const companyId = req.session.companyId;

      // Check if supplier is invited to this RFQ
      const invitation = await query(
        "SELECT * FROM rfq_suppliers WHERE rfq_id = ? AND company_id = ?",
        [rfqId, companyId]
      );

      if (!invitation || invitation.length === 0) {
        return res.status(403).render("shared/error", {
          message: "You are not invited to submit a quote for this RFQ",
          error: { status: 403, stack: "" },
        });
      }

      // Check if quote already submitted
      const existingQuote = await query(
        "SELECT id FROM quotes WHERE rfq_id = ? AND company_id = ?",
        [rfqId, companyId]
      );

      if (existingQuote.length > 0) {
        req.session.flash = {
          error: "You have already submitted a quote for this RFQ",
        };
        return req.session.save((err) => {
          res.redirect("/supplier/rfqs");
        });
      }

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

      // Check RFQ is still open
      if (rfq.status !== "open") {
        req.session.flash = { error: "This RFQ is no longer accepting quotes" };
        return req.session.save((err) => {
          res.redirect("/supplier/rfqs");
        });
      }

      // Check deadline
      if (new Date(rfq.deadline) < new Date()) {
        req.session.flash = { error: "The deadline for this RFQ has passed" };
        return req.session.save((err) => {
          res.redirect("/supplier/rfqs");
        });
      }

      // Get supplier company info
      const companies = await query("SELECT * FROM companies WHERE id = ?", [
        companyId,
      ]);
      const supplierCompany = companies[0];

      // Get materials for this RFQ
      const materials = await query(
        "SELECT m.*, rm.quantity FROM materials m JOIN rfq_materials rm ON m.id = rm.material_id WHERE rm.rfq_id = ?",
        [rfqId]
      );

      res.render("quotes/quote-submit", {
        title: `Submit Quote - ${rfq.name} - FlowBuilder`,
        rfq,
        materials,
        supplierCompany,
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
  }
);

// Submit quote API - Only for suppliers who are invited to the RFQ
router.post(
  "/rfqs/:id/quotes",
  requireAuth,
  requireRole("Supplier"),
  validateQuoteSubmission,
  async (req, res) => {
    try {
      const rfqId = req.params.id;
      const companyId = req.session.companyId; // Use session's companyId instead of form input
      const { duration, items } = req.body;

      // Check if supplier is invited to this RFQ
      const invitation = await query(
        "SELECT * FROM rfq_suppliers WHERE rfq_id = ? AND company_id = ?",
        [rfqId, companyId]
      );

      if (!invitation || invitation.length === 0) {
        req.session.flash = {
          error: "You are not invited to submit a quote for this RFQ",
        };
        return req.session.save((err) => {
          res.redirect("/supplier/rfqs");
        });
      }

      // Check RFQ exists and is open
      const rfqData = await query("SELECT * FROM rfqs WHERE id = ?", [rfqId]);

      if (!rfqData || rfqData.length === 0) {
        req.session.flash = { error: "RFQ not found" };
        return req.session.save((err) => {
          res.redirect("/supplier/rfqs");
        });
      }

      const rfq = rfqData[0];

      // Check RFQ status
      if (rfq.status !== "open") {
        req.session.flash = { error: "This RFQ is not accepting quotes" };
        return req.session.save((err) => {
          res.redirect("/supplier/rfqs");
        });
      }

      // Check if deadline passed
      if (new Date(rfq.deadline) < new Date()) {
        req.session.flash = { error: "RFQ deadline has passed" };
        return req.session.save((err) => {
          res.redirect("/supplier/rfqs");
        });
      }

      // Check for duplicate submission
      const existingQuotes = await query(
        "SELECT id FROM quotes WHERE rfq_id = ? AND company_id = ?",
        [rfqId, companyId]
      );

      if (existingQuotes.length > 0) {
        req.session.flash = {
          error: "You have already submitted a quote for this RFQ",
        };
        return req.session.save((err) => {
          res.redirect("/supplier/rfqs");
        });
      }

      // Insert quote
      const result = await query(
        "INSERT INTO quotes (rfq_id, company_id, duration, status) VALUES (?, ?, ?, ?)",
        [rfqId, companyId, duration, "submitted"]
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
        "UPDATE rfq_suppliers SET status = 'submitted', responded_at = NOW() WHERE rfq_id = ? AND company_id = ?",
        [rfqId, companyId]
      );

      req.session.flash = { success: "Quote submitted successfully" };
      req.session.save((err) => {
        res.redirect("/supplier/rfqs");
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
      `SELECT q.*, r.name as rfq_name, r.project_id, p.company_id, c.name as supplier_name
       FROM quotes q
       JOIN rfqs r ON q.rfq_id = r.id
       JOIN projects p ON r.project_id = p.id
       JOIN companies c ON q.company_id = c.id
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
      "SELECT q.*, c.name as supplier_name, c.email as supplier_email FROM quotes q JOIN companies c ON q.company_id = c.id WHERE q.rfq_id = ?",
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
      `SELECT c.id, c.name, c.email, c.trade_specialty,
              rs.status as tracking_status,
              rs.notified_at,
              rs.responded_at
       FROM rfq_suppliers rs
       JOIN companies c ON rs.company_id = c.id
       WHERE rs.rfq_id = ?
       ORDER BY c.name`,
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
