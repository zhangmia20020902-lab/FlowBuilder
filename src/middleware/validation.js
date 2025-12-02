// Input validation middleware

function validateLogin(req, res, next) {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).render("signin", {
      title: "Sign In - FlowBuilder",
      layout: false,
      error: "Email and password are required",
    });
  }

  // Basic email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).render("signin", {
      title: "Sign In - FlowBuilder",
      layout: false,
      error: "Invalid email format",
    });
  }

  next();
}

function validateRFQCreation(req, res, next) {
  const { name, deadline, materials, suppliers } = req.body;

  if (!name || !deadline) {
    req.session.flash = {
      error: "RFQ name and deadline are required",
    };
    return res.redirect(`/projects/${req.params.id}/rfqs/create`);
  }

  // Validate deadline is in the future
  const deadlineDate = new Date(deadline);
  if (deadlineDate < new Date()) {
    req.session.flash = {
      error: "Deadline must be in the future",
    };
    return res.redirect(`/projects/${req.params.id}/rfqs/create`);
  }

  // Validate at least one material is selected
  const selectedMaterials =
    materials && typeof materials === "object"
      ? Object.keys(materials).filter((id) => {
          const materialId = parseInt(id);
          const hasSelected =
            materials[id].selected !== undefined &&
            materials[id].selected !== null &&
            materials[id].selected !== "";
          return !isNaN(materialId) && materialId > 0 && hasSelected;
        })
      : [];

  if (selectedMaterials.length === 0) {
    req.session.flash = {
      error: "Please select at least one material for this RFQ",
    };
    return res.redirect(`/projects/${req.params.id}/rfqs/create`);
  }

  // Validate at least one supplier is selected
  if (!suppliers || !Array.isArray(suppliers) || suppliers.length === 0) {
    req.session.flash = {
      error: "Please select at least one supplier for this RFQ",
    };
    return res.redirect(`/projects/${req.params.id}/rfqs/create`);
  }

  next();
}

function validateRFQUpdate(req, res, next) {
  const { name, deadline, materials, suppliers } = req.body;
  const rfqId = req.params.id;

  if (!name || !deadline) {
    req.session.flash = {
      error: "RFQ name and deadline are required",
    };
    return res.redirect(`/rfqs/${rfqId}/edit`);
  }

  // Validate deadline is in the future
  const deadlineDate = new Date(deadline);
  if (deadlineDate < new Date()) {
    req.session.flash = {
      error: "Deadline must be in the future",
    };
    return res.redirect(`/rfqs/${rfqId}/edit`);
  }

  // Validate at least one material is selected
  const selectedMaterials =
    materials && typeof materials === "object"
      ? Object.keys(materials).filter((id) => {
          const materialId = parseInt(id);
          const hasSelected =
            materials[id].selected !== undefined &&
            materials[id].selected !== null &&
            materials[id].selected !== "";
          return !isNaN(materialId) && materialId > 0 && hasSelected;
        })
      : [];

  if (selectedMaterials.length === 0) {
    req.session.flash = {
      error: "Please select at least one material for this RFQ",
    };
    return res.redirect(`/rfqs/${rfqId}/edit`);
  }

  // Validate at least one supplier is selected
  if (!suppliers || !Array.isArray(suppliers) || suppliers.length === 0) {
    req.session.flash = {
      error: "Please select at least one supplier for this RFQ",
    };
    return res.redirect(`/rfqs/${rfqId}/edit`);
  }

  next();
}

function validateQuoteSubmission(req, res, next) {
  const { duration, items } = req.body;

  if (!duration) {
    req.session.flash = {
      error: "Delivery duration is required",
    };
    return res.redirect(`/rfqs/${req.params.id}/submit-quote`);
  }

  // Validate duration is positive
  if (parseInt(duration) <= 0) {
    req.session.flash = {
      error: "Delivery duration must be positive",
    };
    return res.redirect(`/rfqs/${req.params.id}/submit-quote`);
  }

  // Validate items exist and have valid data
  const itemsArray =
    items && typeof items === "object"
      ? Object.values(items).filter(
          (item) => item.material_id && item.price && item.quantity
        )
      : [];

  if (itemsArray.length === 0) {
    req.session.flash = {
      error: "At least one item with price is required",
    };
    return res.redirect(`/rfqs/${req.params.id}/submit-quote`);
  }

  // Validate each item
  for (const item of itemsArray) {
    const price = parseFloat(item.price);
    const quantity = parseInt(item.quantity);

    if (isNaN(price) || price <= 0) {
      req.session.flash = {
        error: "All item prices must be greater than 0",
      };
      return res.redirect(`/rfqs/${req.params.id}/submit-quote`);
    }

    if (isNaN(quantity) || quantity <= 0) {
      req.session.flash = {
        error: "All item quantities must be greater than 0",
      };
      return res.redirect(`/rfqs/${req.params.id}/submit-quote`);
    }
  }

  next();
}

function validateQuoteUpdate(req, res, next) {
  const { duration, items } = req.body;
  const quoteId = req.params.id;

  if (!duration) {
    req.session.flash = {
      error: "Delivery duration is required",
    };
    return res.redirect(`/quotes/${quoteId}/edit`);
  }

  // Validate duration is positive
  if (parseInt(duration) <= 0) {
    req.session.flash = {
      error: "Delivery duration must be positive",
    };
    return res.redirect(`/quotes/${quoteId}/edit`);
  }

  // Validate items if provided
  if (items) {
    const itemsArray =
      typeof items === "object"
        ? Object.values(items).filter(
            (item) => item.material_id && item.price && item.quantity
          )
        : [];

    if (itemsArray.length === 0) {
      req.session.flash = {
        error: "At least one item with price is required",
      };
      return res.redirect(`/quotes/${quoteId}/edit`);
    }

    for (const item of itemsArray) {
      const price = parseFloat(item.price);
      const quantity = parseInt(item.quantity);

      if (isNaN(price) || price <= 0) {
        req.session.flash = {
          error: "All item prices must be greater than 0",
        };
        return res.redirect(`/quotes/${quoteId}/edit`);
      }

      if (isNaN(quantity) || quantity <= 0) {
        req.session.flash = {
          error: "All item quantities must be greater than 0",
        };
        return res.redirect(`/quotes/${quoteId}/edit`);
      }
    }
  }

  next();
}

function validateProjectCreation(req, res, next) {
  const { name } = req.body;

  if (!name || !name.trim()) {
    req.session.flash = {
      error: "Project name is required",
    };
    return res.redirect("/projects/create");
  }

  if (name.length > 255) {
    req.session.flash = {
      error: "Project name must not exceed 255 characters",
    };
    return res.redirect("/projects/create");
  }

  next();
}

function validateProjectUpdate(req, res, next) {
  const { name } = req.body;
  const projectId = req.params.id;

  if (!name || !name.trim()) {
    req.session.flash = {
      error: "Project name is required",
    };
    return res.redirect(`/projects/${projectId}/edit`);
  }

  if (name.length > 255) {
    req.session.flash = {
      error: "Project name must not exceed 255 characters",
    };
    return res.redirect(`/projects/${projectId}/edit`);
  }

  next();
}

function validateCompanyUpdate(req, res, next) {
  const { name } = req.body;

  if (!name || !name.trim()) {
    req.session.flash = {
      error: "Company name is required",
    };
    return res.redirect("/company/edit");
  }

  if (name.length > 255) {
    req.session.flash = {
      error: "Company name must not exceed 255 characters",
    };
    return res.redirect("/company/edit");
  }

  next();
}

async function validateUserCreation(req, res, next) {
  const { name, email, role_id, password } = req.body;
  const { query } = require("../config/database");

  if (!name || !name.trim()) {
    req.session.flash = {
      error: "User name is required",
    };
    return res.redirect("/company/users/create");
  }

  if (!email || !email.trim()) {
    req.session.flash = {
      error: "Email is required",
    };
    return res.redirect("/company/users/create");
  }

  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    req.session.flash = {
      error: "Invalid email format",
    };
    return res.redirect("/company/users/create");
  }

  if (!role_id) {
    req.session.flash = {
      error: "Role is required",
    };
    return res.redirect("/company/users/create");
  }

  if (!password || password.length < 6) {
    req.session.flash = {
      error: "Password must be at least 6 characters",
    };
    return res.redirect("/company/users/create");
  }

  // Check email uniqueness
  try {
    const existingUsers = await query("SELECT id FROM users WHERE email = ?", [
      email,
    ]);
    if (existingUsers && existingUsers.length > 0) {
      req.session.flash = {
        error: "Email already exists",
      };
      return res.redirect("/company/users/create");
    }
  } catch (error) {
    console.error("Email uniqueness check error:", error);
    req.session.flash = {
      error: "Error validating user data",
    };
    return res.redirect("/company/users/create");
  }

  next();
}

async function validateUserUpdate(req, res, next) {
  const { name, email, role_id } = req.body;
  const userId = req.params.id;
  const { query } = require("../config/database");

  if (!name || !name.trim()) {
    req.session.flash = {
      error: "User name is required",
    };
    return res.redirect(`/company/users/${userId}/edit`);
  }

  if (!email || !email.trim()) {
    req.session.flash = {
      error: "Email is required",
    };
    return res.redirect(`/company/users/${userId}/edit`);
  }

  // Email format validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    req.session.flash = {
      error: "Invalid email format",
    };
    return res.redirect(`/company/users/${userId}/edit`);
  }

  if (!role_id) {
    req.session.flash = {
      error: "Role is required",
    };
    return res.redirect(`/company/users/${userId}/edit`);
  }

  // Check email uniqueness (excluding current user)
  try {
    const existingUsers = await query(
      "SELECT id FROM users WHERE email = ? AND id != ?",
      [email, userId]
    );
    if (existingUsers && existingUsers.length > 0) {
      req.session.flash = {
        error: "Email already exists",
      };
      return res.redirect(`/company/users/${userId}/edit`);
    }
  } catch (error) {
    console.error("Email uniqueness check error:", error);
    req.session.flash = {
      error: "Error validating user data",
    };
    return res.redirect(`/company/users/${userId}/edit`);
  }

  next();
}

function validateSupplierCreation(req, res, next) {
  const { name, email, trade_specialty } = req.body;

  if (!name || !name.trim()) {
    req.session.flash = {
      error: "Supplier name is required",
    };
    return res.redirect("/suppliers/create");
  }

  if (name.length > 255) {
    req.session.flash = {
      error: "Supplier name must not exceed 255 characters",
    };
    return res.redirect("/suppliers/create");
  }

  if (email && email.trim()) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      req.session.flash = {
        error: "Invalid email format",
      };
      return res.redirect("/suppliers/create");
    }
  }

  next();
}

function validateSupplierUpdate(req, res, next) {
  const { name, email } = req.body;
  const supplierId = req.params.id;

  if (!name || !name.trim()) {
    req.session.flash = {
      error: "Supplier name is required",
    };
    return res.redirect(`/suppliers/${supplierId}/edit`);
  }

  if (name.length > 255) {
    req.session.flash = {
      error: "Supplier name must not exceed 255 characters",
    };
    return res.redirect(`/suppliers/${supplierId}/edit`);
  }

  if (email && email.trim()) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      req.session.flash = {
        error: "Invalid email format",
      };
      return res.redirect(`/suppliers/${supplierId}/edit`);
    }
  }

  next();
}

function validateMaterialCreation(req, res, next) {
  const { name, sku, unit, category_id } = req.body;

  if (!name || !name.trim()) {
    req.session.flash = {
      error: "Material name is required",
    };
    return res.redirect("/materials/create");
  }

  if (name.length > 255) {
    req.session.flash = {
      error: "Material name must not exceed 255 characters",
    };
    return res.redirect("/materials/create");
  }

  if (!unit || !unit.trim()) {
    req.session.flash = {
      error: "Unit is required",
    };
    return res.redirect("/materials/create");
  }

  if (!category_id) {
    req.session.flash = {
      error: "Category is required",
    };
    return res.redirect("/materials/create");
  }

  next();
}

function validateMaterialUpdate(req, res, next) {
  const { name, unit, category_id } = req.body;
  const materialId = req.params.id;

  if (!name || !name.trim()) {
    req.session.flash = {
      error: "Material name is required",
    };
    return res.redirect(`/materials/${materialId}/edit`);
  }

  if (name.length > 255) {
    req.session.flash = {
      error: "Material name must not exceed 255 characters",
    };
    return res.redirect(`/materials/${materialId}/edit`);
  }

  if (!unit || !unit.trim()) {
    req.session.flash = {
      error: "Unit is required",
    };
    return res.redirect(`/materials/${materialId}/edit`);
  }

  if (!category_id) {
    req.session.flash = {
      error: "Category is required",
    };
    return res.redirect(`/materials/${materialId}/edit`);
  }

  next();
}

function validateCategoryCreation(req, res, next) {
  const { name } = req.body;

  if (!name || !name.trim()) {
    req.session.flash = {
      error: "Category name is required",
    };
    return res.redirect("/materials/categories");
  }

  if (name.length > 100) {
    req.session.flash = {
      error: "Category name must not exceed 100 characters",
    };
    return res.redirect("/materials/categories");
  }

  next();
}

function validatePOStatusUpdate(req, res, next) {
  const { status } = req.body;
  const validStatuses = ["ordered", "confirmed", "shipped", "delivered"];

  if (!status) {
    req.session.flash = {
      error: "Status is required",
    };
    return res.redirect(`/pos/${req.params.id}`);
  }

  if (!validStatuses.includes(status)) {
    req.session.flash = {
      error: "Invalid status value",
    };
    return res.redirect(`/pos/${req.params.id}`);
  }

  next();
}

function validateRFQClose(req, res, next) {
  // This is a simple validation, more complex logic is handled in the route
  // This function ensures the request is valid before processing
  next();
}

function sanitizeInput(str) {
  if (typeof str !== "string") return str;
  return str.trim().replace(/[<>]/g, "");
}

module.exports = {
  validateLogin,
  validateRFQCreation,
  validateRFQUpdate,
  validateRFQClose,
  validateQuoteSubmission,
  validateQuoteUpdate,
  validateProjectCreation,
  validateProjectUpdate,
  validateCompanyUpdate,
  validateUserCreation,
  validateUserUpdate,
  validateSupplierCreation,
  validateSupplierUpdate,
  validateMaterialCreation,
  validateMaterialUpdate,
  validateCategoryCreation,
  validatePOStatusUpdate,
  sanitizeInput,
};
