const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const { query } = require("../config/database");
const { guestOnly } = require("../middleware/auth");
const { validateLogin } = require("../middleware/validation");
const logger = require("../config/logger");

// Show login page
router.get("/", guestOnly, (req, res) => {
  res.render("auth/signin", {
    title: "Sign In - FlowBuilder",
    error: req.query.error,
  });
});

// Handle login
router.post("/auth/login", validateLogin, async (req, res) => {
  const { email, password } = req.body;

  try {
    logger.info("Login attempt", { email, ip: req.ip });

    // Find user by email
    const users = await query(
      `SELECT u.*, r.name as role_name 
       FROM users u 
       JOIN roles r ON u.role_id = r.id 
       WHERE u.email = ?`,
      [email]
    );

    if (!users || users.length === 0) {
      logger.warn("Login failed - user not found", { email, ip: req.ip });

      return res.status(401).render("signin", {
        title: "Sign In - FlowBuilder",
        layout: false,
        error: "Invalid email or password",
      });
    }

    const user = users[0];

    // Verify password with bcrypt
    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) {
      logger.warn("Login failed - invalid password", {
        email,
        userId: user.id,
        ip: req.ip,
      });

      return res.status(401).render("signin", {
        title: "Sign In - FlowBuilder",
        layout: false,
        error: "Invalid email or password",
      });
    }

    // Set session
    req.session.userId = user.id;
    req.session.userRole = user.role_name;
    req.session.companyId = user.company_id;

    // Save session before redirect to ensure it's written to the store
    req.session.save((err) => {
      if (err) {
        logger.error("Session save error", {
          error: err.message,
          userId: user.id,
          email: user.email,
        });

        return res.status(500).render("signin", {
          title: "Sign In - FlowBuilder",
          layout: false,
          error: "An error occurred. Please try again.",
        });
      }

      logger.info("Login successful", {
        userId: user.id,
        email: user.email,
        role: user.role_name,
        ip: req.ip,
      });

      // Redirect to dashboard or return URL
      const returnTo = req.session.returnTo || "/dashboard";
      delete req.session.returnTo;

      res.redirect(returnTo);
    });
  } catch (error) {
    logger.error("Login error", {
      error: error.message,
      stack: error.stack,
      email,
      ip: req.ip,
    });

    res.status(500).render("signin", {
      title: "Sign In - FlowBuilder",
      layout: false,
      error: "An error occurred. Please try again.",
    });
  }
});

// Handle logout
router.post("/auth/logout", (req, res) => {
  const userId = req.session?.userId;
  const userEmail = req.user?.email;

  req.session.destroy((err) => {
    if (err) {
      logger.error("Logout error", {
        error: err.message,
        userId,
        email: userEmail,
      });
    } else {
      logger.info("User logged out", {
        userId,
        email: userEmail,
        ip: req.ip,
      });
    }
    res.redirect("/");
  });
});

// Check auth status (for HTMX)
router.get("/auth/check", (req, res) => {
  res.json({
    authenticated: !!(req.session && req.session.userId),
    user: req.session
      ? {
          id: req.session.userId,
          role: req.session.userRole,
        }
      : null,
  });
});

module.exports = router;
