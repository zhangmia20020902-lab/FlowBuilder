const express = require("express");
const { engine } = require("express-handlebars");
const path = require("path");
const session = require("express-session");
const MySQLStore = require("express-mysql-session")(session);
const morgan = require("morgan");
require("dotenv").config();

const { pool } = require("./config/database");
const { attachUser } = require("./middleware/auth");
const logger = require("./config/logger");

const app = express();

app.engine(
  "hjs",
  engine({
    extname: ".hjs",
    defaultLayout: "layout",
    layoutsDir: path.join(__dirname, "views/layouts"),
    partialsDir: path.join(__dirname, "views/partials"),
    helpers: {
      // Helper for equality comparison
      ifEquals: function (arg1, arg2, options) {
        return arg1 == arg2 ? options.fn(this) : options.inverse(this);
      },
      // Helper for inequality comparison
      ifNotEquals: function (arg1, arg2, options) {
        return arg1 != arg2 ? options.fn(this) : options.inverse(this);
      },
      // Helper to check if material is selected
      isSelected: function (materialId, selectedMaterials, options) {
        let isSelected = false;

        if (
          selectedMaterials &&
          typeof selectedMaterials === "object" &&
          !Array.isArray(selectedMaterials)
        ) {
          isSelected = selectedMaterials.hasOwnProperty(materialId);
        } else if (selectedMaterials && Array.isArray(selectedMaterials)) {
          isSelected = selectedMaterials.some(
            (m) => m.material_id == materialId
          );
        }

        return isSelected ? options.fn(this) : options.inverse(this);
      },
      // Helper to get quantity for selected material
      getQuantity: function (materialId, selectedMaterials) {
        if (
          selectedMaterials &&
          typeof selectedMaterials === "object" &&
          !Array.isArray(selectedMaterials)
        ) {
          return selectedMaterials[materialId]
            ? selectedMaterials[materialId].quantity
            : "";
        }
        if (!selectedMaterials || !Array.isArray(selectedMaterials)) return "";
        const material = selectedMaterials.find(
          (m) => m.material_id == materialId
        );
        return material ? material.quantity : "";
      },
      // Helper to check if supplier is selected
      isSupplierSelected: function (supplierId, selectedSuppliers, options) {
        let isSelected = false;

        if (selectedSuppliers && Array.isArray(selectedSuppliers)) {
          if (
            selectedSuppliers.length > 0 &&
            typeof selectedSuppliers[0] !== "object"
          ) {
            isSelected = selectedSuppliers.includes(parseInt(supplierId));
          } else {
            isSelected = selectedSuppliers.some(
              (s) => s.supplier_id == supplierId
            );
          }
        }

        return isSelected ? options.fn(this) : options.inverse(this);
      },
      // Helper to get item price from quote items
      getItemPrice: function (materialId, quoteItems) {
        if (!quoteItems || !Array.isArray(quoteItems)) return "";
        const item = quoteItems.find((i) => i.material_id == materialId);
        return item ? item.price : "";
      },
      // Helper to stringify JSON for use in JavaScript
      json: function (context) {
        return JSON.stringify(context);
      },
      // Helper to format date display
      formatDate: function (dateString) {
        if (!dateString) return "";
        const date = new Date(dateString);
        return date.toLocaleString("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });
      },
    },
  })
);
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "hjs");

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, "../public")));

app.use(
  morgan(
    ':remote-addr - :remote-user [:date[clf]] ":method :url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent" - :response-time ms',
    {
      stream: logger.stream,
      skip: (req) => {
        // Skip logging for static assets in production
        if (process.env.NODE_ENV === "production") {
          return (
            req.url.startsWith("/css") ||
            req.url.startsWith("/js") ||
            req.url.startsWith("/images")
          );
        }
        return false;
      },
    }
  )
);

const sessionStore = new MySQLStore(
  {
    clearExpired: true,
    checkExpirationInterval: 900000, // 15 minutes
    expiration: 86400000, // 1 day
    createDatabaseTable: true, // Auto-create table if not exists
  },
  pool
);

app.use(
  session({
    key: process.env.SESSION_NAME || "flowbuilder_session",
    secret: process.env.SESSION_SECRET || "your-secret-key",
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 86400000, // 1 day
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
    },
  })
);

app.use(attachUser);

app.use((req, res, next) => {
  res.locals.flash = (req.session && req.session.flash) || {};
  if (req.session && req.session.flash) {
    delete req.session.flash;
  }
  next();
});

const authRoutes = require("./routes/auth");
const dashboardRoutes = require("./routes/dashboard");
const projectRoutes = require("./routes/projects");
const rfqRoutes = require("./routes/rfqs");
const quoteRoutes = require("./routes/quotes");

app.use("/", authRoutes);
app.use("/", dashboardRoutes);
app.use("/", projectRoutes);
app.use("/", rfqRoutes);
app.use("/", quoteRoutes);

app.use((req, res, next) => {
  res.status(404).render("shared/error", {
    title: "Page Not Found - FlowBuilder",
    message: "Page Not Found",
    error: { status: 404, stack: "" },
  });
});

app.use((err, req, res, next) => {
  logger.error("Application Error", {
    message: err.message,
    stack: err.stack,
    status: err.status || 500,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    userId: req.session?.userId,
    userAgent: req.get("user-agent"),
  });

  res.status(err.status || 500).render("shared/error", {
    title: "Error - FlowBuilder",
    message: err.message || "Internal Server Error",
    error: {
      status: err.status || 500,
      stack: process.env.NODE_ENV === "development" ? err.stack : "",
    },
  });
});

module.exports = app;
