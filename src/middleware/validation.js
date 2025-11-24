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
  const { name, deadline } = req.body;

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

  next();
}

function validateRFQUpdate(req, res, next) {
  const { name, deadline } = req.body;
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

  next();
}

function validateQuoteSubmission(req, res, next) {
  const { supplier_id, duration } = req.body;

  if (!supplier_id || !duration) {
    req.session.flash = {
      error: "Supplier and delivery duration are required",
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

  next();
}

function validateQuoteUpdate(req, res, next) {
  const { duration } = req.body;
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

function sanitizeInput(str) {
  if (typeof str !== "string") return str;
  return str.trim().replace(/[<>]/g, "");
}

module.exports = {
  validateLogin,
  validateRFQCreation,
  validateRFQUpdate,
  validateQuoteSubmission,
  validateQuoteUpdate,
  validateProjectCreation,
  validateProjectUpdate,
  sanitizeInput,
};
