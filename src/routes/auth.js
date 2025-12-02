const express = require("express");
const router = express.Router();
const bcrypt = require("bcryptjs");
const { query, getConnection } = require("../config/database");
const { guestOnly,requireAuth  } = require("../middleware/auth");
const { validateLogin, validateSignup } = require("../middleware/validation");
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

// GET /signup - Show registration form (Newly added route)
router.get("/auth/signup", guestOnly, (req, res) => {
  res.render("auth/signup", {
    title: "Sign Up - FlowBuilder",
    layout: "auth-layout",
    // Flash messages are automatically available in res.locals due to app.js middleware
  });
});

// POST /signup - Handle registration logic (Newly added route)
router.post("/auth/signup", validateSignup, async (req, res) => {
  const { company_name, name, email, password } = req.body;
  let connection;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // 1. Get the default 'Admin' role ID for new companies
    const adminRole = await query(
      "SELECT id FROM roles WHERE name = 'Admin' LIMIT 1"
    );

    if (!adminRole || adminRole.length === 0) {
      logger.error("Admin role not found. Database setup error.", { email, companyName: company_name });
      throw new Error("Admin role not found. Database setup error.");
    }
    const adminRoleId = adminRole[0].id;

    // --- Start Transaction ---
    connection = await getConnection();
    await connection.beginTransaction();

    // 2. Insert new Company (type 'client' by default for new registrations)
    const [companyResult] = await connection.execute(
      "INSERT INTO companies (name, type) VALUES (?, 'client')",
      [company_name]
    );
    const companyId = companyResult.insertId;

    // 3. Insert initial Admin User
    const [userResult] = await connection.execute(
      "INSERT INTO users (company_id, role_id, name, email, password) VALUES (?, ?, ?, ?, ?)",
      [companyId, adminRoleId, name, email, hashedPassword]
    );
    const userId = userResult.insertId;

    await connection.commit(); // Commit transaction

    // 4. Create Session and Redirect
    req.session.userId = userId;
    req.session.userRole = 'Admin';
    req.session.companyId = companyId;
    
    logger.info("User Registered", { userId, email, companyId, companyName: company_name });

    req.session.flash = {
      success: "Account created successfully. Welcome to FlowBuilder!",
    };
    
    req.session.save((err) => {
      if (err) logger.error("Session save error during signup success", { error: err.message, userId });
      res.redirect("/dashboard");
    });

  } catch (error) {
    if (connection) {
      await connection.rollback(); // Rollback on failure
    }
    logger.error("User registration failed (Transaction Rolled Back)", {
      error: error.message,
      stack: error.stack,
      email,
      companyName: company_name,
    });

    req.session.flash = {
      error: "Registration failed. Please try again.",
    };
    req.session.save((err) => {
      if (err) logger.error("Session save error during signup failure", { error: err.message, email });
      res.redirect("/auth/signup");
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

module.exports = router;
