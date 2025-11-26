const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middleware/auth");
const { query } = require("../config/database");
const logger = require("../config/logger");

// Dashboard overview
router.get("/dashboard", requireAuth, async (req, res) => {
  try {
    const companyId = req.session.companyId;

    // Get statistics
    const projectCount = await query(
      "SELECT COUNT(*) as count FROM projects WHERE company_id = ?",
      [companyId]
    );

    const rfqCount = await query(
      "SELECT COUNT(*) as count FROM rfqs r JOIN projects p ON r.project_id = p.id WHERE p.company_id = ?",
      [companyId]
    );

    const openRfqCount = await query(
      'SELECT COUNT(*) as count FROM rfqs r JOIN projects p ON r.project_id = p.id WHERE p.company_id = ? AND r.status = "open"',
      [companyId]
    );

    const poCount = await query(
      "SELECT COUNT(*) as count FROM pos po JOIN quotes q ON po.quote_id = q.id JOIN rfqs r ON q.rfq_id = r.id JOIN projects p ON r.project_id = p.id WHERE p.company_id = ?",
      [companyId]
    );

    // Get additional statistics
    const supplierCount = await query(
      "SELECT COUNT(*) as count FROM suppliers WHERE company_id = ?",
      [companyId]
    );

    const materialCount = await query(
      "SELECT COUNT(*) as count FROM materials WHERE company_id = ?",
      [companyId]
    );

    const userCount = await query(
      "SELECT COUNT(*) as count FROM users WHERE company_id = ?",
      [companyId]
    );

    const activePOCount = await query(
      "SELECT COUNT(*) as count FROM pos po JOIN quotes q ON po.quote_id = q.id JOIN rfqs r ON q.rfq_id = r.id JOIN projects p ON r.project_id = p.id WHERE p.company_id = ? AND po.status NOT IN ('delivered', 'cancelled')",
      [companyId]
    );

    // Get recent projects
    const recentProjects = await query(
      "SELECT * FROM projects WHERE company_id = ? ORDER BY created_at DESC LIMIT 5",
      [companyId]
    );

    // Get recent RFQs
    const recentRfqs = await query(
      "SELECT r.*, p.name as project_name FROM rfqs r JOIN projects p ON r.project_id = p.id WHERE p.company_id = ? ORDER BY r.created_at DESC LIMIT 5",
      [companyId]
    );

    // Get recent POs
    const recentPOs = await query(
      "SELECT po.*, p.name as project_name, s.name as supplier_name FROM pos po JOIN quotes q ON po.quote_id = q.id JOIN suppliers s ON q.supplier_id = s.id JOIN rfqs r ON q.rfq_id = r.id JOIN projects p ON r.project_id = p.id WHERE p.company_id = ? ORDER BY po.created_at DESC LIMIT 5",
      [companyId]
    );

    res.render("dashboard/dashboard", {
      title: "Dashboard - FlowBuilder",
      stats: {
        projects: projectCount[0].count,
        rfqs: rfqCount[0].count,
        openRfqs: openRfqCount[0].count,
        pos: poCount[0].count,
        suppliers: supplierCount[0].count,
        materials: materialCount[0].count,
        users: userCount[0].count,
        activePOs: activePOCount[0].count,
      },
      recentProjects,
      recentRfqs,
      recentPOs,
    });
  } catch (error) {
    logger.error("Dashboard error", {
      error: error.message,
      stack: error.stack,
      userId: req.session?.userId,
    });
    res.status(500).render("shared/error", {
      message: "Error loading dashboard",
      error: { status: 500, stack: error.stack },
    });
  }
});

module.exports = router;
