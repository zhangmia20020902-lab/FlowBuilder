const express = require("express");
const router = express.Router();
const { requireAuth } = require("../middleware/auth");
const { query } = require("../config/database");
const {
  validateMaterialCreation,
  validateMaterialUpdate,
  validateCategoryCreation,
} = require("../middleware/validation");

// List all materials with search and filter
router.get("/materials", requireAuth, async (req, res) => {
  try {
    const companyId = req.session.companyId;
    const { search, category } = req.query;

    let sql = `
      SELECT m.*, c.name as category_name 
      FROM materials m 
      LEFT JOIN categories c ON m.category_id = c.id 
      WHERE m.company_id = ?
    `;
    const params = [companyId];

    if (search && search.trim()) {
      sql += " AND (m.name LIKE ? OR m.sku LIKE ?)";
      const searchTerm = `%${search.trim()}%`;
      params.push(searchTerm, searchTerm);
    }

    if (category && category !== "all") {
      sql += " AND m.category_id = ?";
      params.push(category);
    }

    sql += " ORDER BY m.name ASC";

    const materials = await query(sql, params);

    // Get all categories for filter dropdown
    const categories = await query(
      "SELECT * FROM categories ORDER BY name ASC"
    );

    res.render("materials/materials", {
      title: "Materials Catalog - FlowBuilder",
      materials,
      categories,
      search: search || "",
      selectedCategory: category || "all",
    });
  } catch (error) {
    console.error("Materials list error:", error);
    res.status(500).render("shared/error", {
      message: "Error loading materials",
      error: { status: 500, stack: error.stack },
    });
  }
});

// Create material form
router.get("/materials/create", requireAuth, async (req, res) => {
  try {
    // Get all categories for dropdown
    const categories = await query(
      "SELECT * FROM categories ORDER BY name ASC"
    );

    res.render("materials/material-create", {
      title: "Create Material - FlowBuilder",
      categories,
    });
  } catch (error) {
    console.error("Material create form error:", error);
    res.status(500).render("shared/error", {
      message: "Error loading material form",
      error: { status: 500, stack: error.stack },
    });
  }
});

// Create material API
router.post(
  "/materials",
  requireAuth,
  validateMaterialCreation,
  async (req, res) => {
    try {
      const companyId = req.session.companyId;
      const { name, sku, unit, category_id } = req.body;

      await query(
        "INSERT INTO materials (company_id, name, sku, unit, category_id) VALUES (?, ?, ?, ?, ?)",
        [companyId, name, sku || null, unit, category_id]
      );

      req.session.flash = {
        success: "Material created successfully",
      };
      req.session.save((err) => {
        if (err) console.error("Session save error:", err);
        res.redirect("/materials");
      });
    } catch (error) {
      console.error("Material create error:", error);
      req.session.flash = {
        error: "Error creating material",
      };
      req.session.save((err) => {
        if (err) console.error("Session save error:", err);
        res.redirect("/materials/create");
      });
    }
  }
);

// Material detail
router.get("/materials/:id", requireAuth, async (req, res) => {
  try {
    const materialId = req.params.id;
    const companyId = req.session.companyId;

    const materials = await query(
      `SELECT m.*, c.name as category_name 
       FROM materials m 
       LEFT JOIN categories c ON m.category_id = c.id 
       WHERE m.id = ? AND m.company_id = ?`,
      [materialId, companyId]
    );

    if (!materials || materials.length === 0) {
      return res.status(404).render("shared/error", {
        message: "Material not found",
        error: { status: 404, stack: "" },
      });
    }

    const material = materials[0];

    // Get usage in RFQs
    const rfqUsage = await query(
      `SELECT r.id, r.name, rm.quantity, p.name as project_name
       FROM rfq_materials rm
       JOIN rfqs r ON rm.rfq_id = r.id
       JOIN projects p ON r.project_id = p.id
       WHERE rm.material_id = ? AND p.company_id = ?
       ORDER BY r.created_at DESC
       LIMIT 10`,
      [materialId, companyId]
    );

    res.render("materials/material-detail", {
      title: `${material.name} - FlowBuilder`,
      material,
      rfqUsage,
    });
  } catch (error) {
    console.error("Material detail error:", error);
    res.status(500).render("shared/error", {
      message: "Error loading material",
      error: { status: 500, stack: error.stack },
    });
  }
});

// Edit material form
router.get("/materials/:id/edit", requireAuth, async (req, res) => {
  try {
    const materialId = req.params.id;
    const companyId = req.session.companyId;

    const materials = await query(
      "SELECT * FROM materials WHERE id = ? AND company_id = ?",
      [materialId, companyId]
    );

    if (!materials || materials.length === 0) {
      return res.status(404).render("shared/error", {
        message: "Material not found",
        error: { status: 404, stack: "" },
      });
    }

    const material = materials[0];

    // Get all categories for dropdown
    const categories = await query(
      "SELECT * FROM categories ORDER BY name ASC"
    );

    res.render("materials/material-edit", {
      title: `Edit ${material.name} - FlowBuilder`,
      material,
      categories,
    });
  } catch (error) {
    console.error("Material edit form error:", error);
    res.status(500).render("shared/error", {
      message: "Error loading material form",
      error: { status: 500, stack: error.stack },
    });
  }
});

// Update material API
router.post(
  "/materials/:id/update",
  requireAuth,
  validateMaterialUpdate,
  async (req, res) => {
    try {
      const materialId = req.params.id;
      const companyId = req.session.companyId;
      const { name, sku, unit, category_id } = req.body;

      // Verify material belongs to user's company
      const materials = await query(
        "SELECT * FROM materials WHERE id = ? AND company_id = ?",
        [materialId, companyId]
      );

      if (!materials || materials.length === 0) {
        return res.status(404).render("shared/error", {
          message: "Material not found",
          error: { status: 404, stack: "" },
        });
      }

      await query(
        "UPDATE materials SET name = ?, sku = ?, unit = ?, category_id = ? WHERE id = ? AND company_id = ?",
        [name, sku || null, unit, category_id, materialId, companyId]
      );

      req.session.flash = {
        success: "Material updated successfully",
      };
      req.session.save((err) => {
        if (err) console.error("Session save error:", err);
        res.redirect(`/materials/${materialId}`);
      });
    } catch (error) {
      console.error("Material update error:", error);
      req.session.flash = {
        error: "Error updating material",
      };
      req.session.save((err) => {
        if (err) console.error("Session save error:", err);
        res.redirect(`/materials/${req.params.id}/edit`);
      });
    }
  }
);

// Delete material API
router.post("/materials/:id/delete", requireAuth, async (req, res) => {
  try {
    const materialId = req.params.id;
    const companyId = req.session.companyId;

    // Verify material belongs to user's company
    const materials = await query(
      "SELECT * FROM materials WHERE id = ? AND company_id = ?",
      [materialId, companyId]
    );

    if (!materials || materials.length === 0) {
      return res.status(404).render("shared/error", {
        message: "Material not found",
        error: { status: 404, stack: "" },
      });
    }

    // Check if material is used in any active RFQs
    const activeRfqUsage = await query(
      `SELECT COUNT(*) as count FROM rfq_materials rm
       JOIN rfqs r ON rm.rfq_id = r.id
       WHERE rm.material_id = ? AND r.status != 'closed'`,
      [materialId]
    );

    if (activeRfqUsage[0].count > 0) {
      req.session.flash = {
        error: "Cannot delete material: it is used in active RFQs",
      };
      req.session.save((err) => {
        if (err) console.error("Session save error:", err);
        res.redirect("/materials");
      });
      return;
    }

    // Delete material
    await query("DELETE FROM materials WHERE id = ? AND company_id = ?", [
      materialId,
      companyId,
    ]);

    req.session.flash = {
      success: "Material deleted successfully",
    };
    req.session.save((err) => {
      if (err) console.error("Session save error:", err);
      res.redirect("/materials");
    });
  } catch (error) {
    console.error("Material delete error:", error);
    req.session.flash = {
      error: "Error deleting material",
    };
    req.session.save((err) => {
      if (err) console.error("Session save error:", err);
      res.redirect("/materials");
    });
  }
});

// Categories Management
router.get("/materials/categories/manage", requireAuth, async (req, res) => {
  try {
    const categories = await query(
      "SELECT c.*, COUNT(m.id) as material_count FROM categories c LEFT JOIN materials m ON c.id = m.category_id GROUP BY c.id ORDER BY c.name ASC"
    );

    res.render("materials/categories", {
      title: "Material Categories - FlowBuilder",
      categories,
    });
  } catch (error) {
    console.error("Categories list error:", error);
    res.status(500).render("shared/error", {
      message: "Error loading categories",
      error: { status: 500, stack: error.stack },
    });
  }
});

// Create category API
router.post(
  "/materials/categories",
  requireAuth,
  validateCategoryCreation,
  async (req, res) => {
    try {
      const { name, description } = req.body;

      await query("INSERT INTO categories (name, description) VALUES (?, ?)", [
        name,
        description || null,
      ]);

      req.session.flash = {
        success: "Category created successfully",
      };
      req.session.save((err) => {
        if (err) console.error("Session save error:", err);
        res.redirect("/materials/categories/manage");
      });
    } catch (error) {
      console.error("Category create error:", error);
      if (error.code === "ER_DUP_ENTRY") {
        req.session.flash = {
          error: "Category name already exists",
        };
      } else {
        req.session.flash = {
          error: "Error creating category",
        };
      }
      req.session.save((err) => {
        if (err) console.error("Session save error:", err);
        res.redirect("/materials/categories/manage");
      });
    }
  }
);

// Update category API
router.post(
  "/materials/categories/:id/update",
  requireAuth,
  async (req, res) => {
    try {
      const categoryId = req.params.id;
      const { name, description } = req.body;

      if (!name || !name.trim()) {
        req.session.flash = {
          error: "Category name is required",
        };
        req.session.save((err) => {
          if (err) console.error("Session save error:", err);
          res.redirect("/materials/categories/manage");
        });
        return;
      }

      await query(
        "UPDATE categories SET name = ?, description = ? WHERE id = ?",
        [name, description || null, categoryId]
      );

      req.session.flash = {
        success: "Category updated successfully",
      };
      req.session.save((err) => {
        if (err) console.error("Session save error:", err);
        res.redirect("/materials/categories/manage");
      });
    } catch (error) {
      console.error("Category update error:", error);
      if (error.code === "ER_DUP_ENTRY") {
        req.session.flash = {
          error: "Category name already exists",
        };
      } else {
        req.session.flash = {
          error: "Error updating category",
        };
      }
      req.session.save((err) => {
        if (err) console.error("Session save error:", err);
        res.redirect("/materials/categories/manage");
      });
    }
  }
);

// Delete category API
router.post(
  "/materials/categories/:id/delete",
  requireAuth,
  async (req, res) => {
    try {
      const categoryId = req.params.id;

      // Check if category has materials
      const materialCount = await query(
        "SELECT COUNT(*) as count FROM materials WHERE category_id = ?",
        [categoryId]
      );

      if (materialCount[0].count > 0) {
        req.session.flash = {
          error: "Cannot delete category: it has associated materials",
        };
        req.session.save((err) => {
          if (err) console.error("Session save error:", err);
          res.redirect("/materials/categories/manage");
        });
        return;
      }

      await query("DELETE FROM categories WHERE id = ?", [categoryId]);

      req.session.flash = {
        success: "Category deleted successfully",
      };
      req.session.save((err) => {
        if (err) console.error("Session save error:", err);
        res.redirect("/materials/categories/manage");
      });
    } catch (error) {
      console.error("Category delete error:", error);
      req.session.flash = {
        error: "Error deleting category",
      };
      req.session.save((err) => {
        if (err) console.error("Session save error:", err);
        res.redirect("/materials/categories/manage");
      });
    }
  }
);

module.exports = router;
