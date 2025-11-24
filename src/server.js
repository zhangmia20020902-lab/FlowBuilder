require("dotenv").config();
const app = require("./app");
const { testConnection } = require("./config/database");
const { runMigrations, runSeeds } = require("./utils/migrate");
const logger = require("./config/logger");

const PORT = process.env.PORT || 3000;

async function startServer() {
  logger.info("Starting FlowBuilder...");

  let connected = false;
  let retries = 10;

  while (!connected && retries > 0) {
    connected = await testConnection();
    if (!connected) {
      logger.warn(`Waiting for database... (${retries} retries left)`);
      await new Promise((resolve) => setTimeout(resolve, 3000));
      retries--;
    }
  }

  if (!connected) {
    logger.error("Could not connect to database. Exiting...");
    process.exit(1);
  }

  try {
    await runMigrations();

    await runSeeds();

    app.listen(PORT, () => {
      logger.info(`FlowBuilder running on http://localhost:${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || "development"}`);
    });
  } catch (error) {
    logger.error("Failed to start server", {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
}

process.on("uncaughtException", (error) => {
  setTimeout(() => process.exit(1), 1000);
});

process.on("unhandledRejection", (reason, promise) => {
  setTimeout(() => process.exit(1), 1000);
});

startServer();
