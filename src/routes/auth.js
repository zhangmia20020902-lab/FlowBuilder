const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const { query } = require("../config/database");
const { guestOnly } = require("../middleware/auth");
const { validateLogin } = require("../middleware/validation");
const logger = require("../config/logger");

// Redirect root to signin page
router.get("/", guestOnly, (req, res) => {
  res.redirect("/auth/signin");
});

// Show login page
router.get("/auth/signin", guestOnly, (req, res) => {
  // Use res.locals.flash which is populated by the global middleware in app.js
  // The middleware already handles reading from session and cleanup
  res.render("auth/signin", {
    layout: "auth-layout",
    title: "Sign In - FlowBuilder",
    error: res.locals.flash.error || req.query.error,
    success: res.locals.flash.success,
  });
});

// Handle login
router.post("/auth/signin", validateLogin, async (req, res) => {
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

      req.session.flash = {
        error: "Invalid email or password",
      };
      req.session.save((err) => {
        if (err) {
          logger.error("Session save error", { error: err.message, email });
        }
        res.redirect("/auth/signin");
      });
      return;
    }

    const user = users[0];

    const isValid = await bcrypt.compare(password, user.password);

    if (!isValid) {
      logger.warn("Login failed - invalid password", {
        email,
        userId: user.id,
        ip: req.ip,
      });

      req.session.flash = {
        error: "Invalid email or password",
      };
      req.session.save((err) => {
        if (err) {
          logger.error("Session save error", { error: err.message, email });
        }
        res.redirect("/auth/signin");
      });
      return;
    }

    // Set session
    req.session.userId = user.id;
    req.session.userRole = user.role_name;
    req.session.companyId = user.company_id;

    req.session.save((err) => {
      if (err) {
        logger.error("Session save error", {
          error: err.message,
          userId: user.id,
          email: user.email,
        });

        req.session.flash = {
          error: "An error occurred. Please try again.",
        };
        req.session.save((saveErr) => {
          if (saveErr)
            logger.error("Session save error", { error: saveErr.message });
          res.redirect("/auth/signin");
        });
        return;
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

    req.session.flash = {
      error: "An error occurred. Please try again.",
    };
    req.session.save((err) => {
      if (err) {
        logger.error("Session save error", { error: err.message });
      }
      res.redirect("/auth/signin");
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
