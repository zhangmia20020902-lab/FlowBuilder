// Authentication middleware
const logger = require("../config/logger");

// Require authentication
function requireAuth(req, res, next) {
  if (req.session && req.session.userId) {
    return next();
  }

  // Log unauthorized access attempt
  logger.warn("Unauthorized access attempt", {
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userAgent: req.get("user-agent"),
  });

  // Store the original URL to redirect after login
  req.session.returnTo = req.originalUrl;

  // Check if it's an HTMX request
  if (req.headers["hx-request"]) {
    // For HTMX requests, send a redirect header
    res.setHeader("HX-Redirect", "/");
    return res.status(401).send("Unauthorized");
  }

  // For regular requests, redirect to login
  return res.redirect("/");
}

// Require specific role
function requireRole(...roles) {
  return (req, res, next) => {
    if (!req.session || !req.session.userId) {
      logger.warn("Role check failed - no session", {
        url: req.originalUrl,
        requiredRoles: roles,
        ip: req.ip,
      });
      return res.redirect("/");
    }

    if (!req.session.userRole || !roles.includes(req.session.userRole)) {
      logger.warn("Access denied - insufficient permissions", {
        userId: req.session.userId,
        userRole: req.session.userRole,
        requiredRoles: roles,
        url: req.originalUrl,
        ip: req.ip,
      });

      return res.status(403).render("shared/error", {
        message: "Access Denied",
        error: { status: 403, stack: "" },
      });
    }

    next();
  };
}

// Attach user to request and response locals
async function attachUser(req, res, next) {
  if (req.session && req.session.userId) {
    try {
      const { query } = require("../config/database");
      const users = await query(
        `SELECT u.*, r.name as role_name, c.name as company_name 
         FROM users u 
         JOIN roles r ON u.role_id = r.id 
         JOIN companies c ON u.company_id = c.id 
         WHERE u.id = ?`,
        [req.session.userId]
      );

      if (users && users.length > 0) {
        req.user = users[0];
        res.locals.user = users[0];
        res.locals.isAuthenticated = true;

        const notifications = await query(
          `SELECT COUNT(*) AS unread 
           FROM notifications 
           WHERE user_id = ? AND is_read = FALSE`,
          [req.session.userId]
        );

        res.locals.unreadNotifications = notifications[0].unread;


        logger.debug("User attached to request", {
          userId: users[0].id,
          userRole: users[0].role_name,
          userEmail: users[0].email,
        });
      } else {
        // User not found, clear session data
        logger.warn("User session invalid - user not found in database", {
          sessionUserId: req.session.userId,
        });

        delete req.session.userId;
        delete req.session.userRole;
        res.locals.isAuthenticated = false;
      }
    } catch (error) {
      logger.error("Error fetching user data", {
        error: error.message,
        stack: error.stack,
        sessionUserId: req.session.userId,
      });
      res.locals.isAuthenticated = false;
    }
  } else {
    res.locals.isAuthenticated = false;
  }

  next();
}

// Check if user is guest (not authenticated)
function guestOnly(req, res, next) {
  if (req.session && req.session.userId) {
    return res.redirect("/dashboard");
  }
  next();
}

module.exports = {
  requireAuth,
  requireRole,
  attachUser,
  guestOnly,
};
