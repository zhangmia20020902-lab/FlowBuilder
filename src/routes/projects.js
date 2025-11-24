const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middleware/auth");
const { query } = require("../config/database");
const {
  validateProjectCreation,
  validateProjectUpdate,
} = require("../middleware/validation");

// List all projects
router.get("/projects", requireAuth, async (req, res) => {
  try {
    const companyId = req.session.companyId;

    const projects = await query(
      "SELECT * FROM projects WHERE company_id = ? ORDER BY created_at DESC",
      [companyId]
    );

    res.render("projects/projects", {
      title: "Projects - FlowBuilder",
      projects,
    });
  } catch (error) {
    console.error("Projects list error:", error);
    res.status(500).render("shared/error", {
      message: "Error loading projects",
      error: { status: 500, stack: error.stack },
    });
  }
});

// Create project form
router.get("/projects/create", requireAuth, async (req, res) => {
  try {
    res.render("projects/project-create", {
      title: "Create Project - FlowBuilder",
    });
  } catch (error) {
    console.error("Project create form error:", error);
    res.status(500).render("shared/error", {
      message: "Error loading project form",
      error: { status: 500, stack: error.stack },
    });
  }
});

// Create project API
router.post(
  "/projects",
  requireAuth,
  validateProjectCreation,
  async (req, res) => {
    try {
      const companyId = req.session.companyId;
      const { name, description } = req.body;

      await query(
        "INSERT INTO projects (company_id, name, description) VALUES (?, ?, ?)",
        [companyId, name, description || null]
      );

      req.session.flash = {
        success: "Project created successfully",
      };
      req.session.save((err) => {
        if (err) console.error("Session save error:", err);
        res.redirect("/projects");
      });
    } catch (error) {
      console.error("Project create error:", error);
      req.session.flash = {
        error: "Error creating project",
      };
      req.session.save((err) => {
        if (err) console.error("Session save error:", err);
        res.redirect("/projects/create");
      });
    }
  }
);

// Edit project form
router.get("/projects/:id/edit", requireAuth, async (req, res) => {
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

    res.render("projects/project-edit", {
      title: `Edit ${project.name} - FlowBuilder`,
      project,
    });
  } catch (error) {
    console.error("Project edit form error:", error);
    res.status(500).render("shared/error", {
      message: "Error loading project form",
      error: { status: 500, stack: error.stack },
    });
  }
});

// Update project API
router.post(
  "/projects/:id/update",
  requireAuth,
  validateProjectUpdate,
  async (req, res) => {
    try {
      const projectId = req.params.id;
      const companyId = req.session.companyId;
      const { name, description } = req.body;

      // Verify project belongs to user's company
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

      await query(
        "UPDATE projects SET name = ?, description = ? WHERE id = ? AND company_id = ?",
        [name, description || null, projectId, companyId]
      );

      req.session.flash = {
        success: "Project updated successfully",
      };
      req.session.save((err) => {
        if (err) console.error("Session save error:", err);
        res.redirect(`/projects/${projectId}`);
      });
    } catch (error) {
      console.error("Project update error:", error);
      req.session.flash = {
        error: "Error updating project",
      };
      req.session.save((err) => {
        if (err) console.error("Session save error:", err);
        res.redirect(`/projects/${req.params.id}/edit`);
      });
    }
  }
);

// Project detail
router.get("/projects/:id", requireAuth, async (req, res) => {
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

    // Get RFQs for this project
    const rfqs = await query(
      "SELECT * FROM rfqs WHERE project_id = ? ORDER BY created_at DESC",
      [projectId]
    );

    // Get POs for this project
    const pos = await query(
      `SELECT po.*, q.supplier_id, s.name as supplier_name 
       FROM pos po 
       JOIN quotes q ON po.quote_id = q.id 
       JOIN suppliers s ON q.supplier_id = s.id
       JOIN rfqs r ON q.rfq_id = r.id
       WHERE r.project_id = ? 
       ORDER BY po.created_at DESC`,
      [projectId]
    );

    res.render("projects/project-detail", {
      title: `${project.name} - FlowBuilder`,
      project,
      rfqs,
      pos,
    });
  } catch (error) {
    console.error("Project detail error:", error);
    res.status(500).render("shared/error", {
      message: "Error loading project",
      error: { status: 500, stack: error.stack },
    });
  }
});

// Delete project API
router.post("/projects/:id/delete", requireAuth, async (req, res) => {
  try {
    const projectId = req.params.id;
    const companyId = req.session.companyId;

    // Verify project belongs to user's company
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

    // Delete project (cascade will handle RFQs, quotes, POs)
    await query("DELETE FROM projects WHERE id = ? AND company_id = ?", [
      projectId,
      companyId,
    ]);

    req.session.flash = {
      success: "Project deleted successfully",
    };
    req.session.save((err) => {
      if (err) console.error("Session save error:", err);
      res.redirect("/projects");
    });
  } catch (error) {
    console.error("Project delete error:", error);
    req.session.flash = {
      error: "Error deleting project",
    };
    req.session.save((err) => {
      if (err) console.error("Session save error:", err);
      res.redirect("/dashboard");
    });
  }
});

// PO Tracker
router.get("/projects/:id/po-tracker", requireAuth, async (req, res) => {
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

    // Get all POs for this project
    const pos = await query(
      `SELECT po.*, q.supplier_id, s.name as supplier_name, r.name as rfq_name
       FROM pos po 
       JOIN quotes q ON po.quote_id = q.id 
       JOIN suppliers s ON q.supplier_id = s.id
       JOIN rfqs r ON q.rfq_id = r.id
       WHERE r.project_id = ? 
       ORDER BY po.created_at DESC`,
      [projectId]
    );

    res.render("pos/po-tracker", {
      title: `PO Tracker - ${project.name} - FlowBuilder`,
      project,
      pos,
    });
  } catch (error) {
    console.error("PO Tracker error:", error);
    res.status(500).render("shared/error", {
      message: "Error loading PO tracker",
      error: { status: 500, stack: error.stack },
    });
  }
});

module.exports = router;
