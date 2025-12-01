const fs = require("fs").promises;
const path = require("path");
const { pool } = require("../config/database");
const logger = require("../config/logger");

async function runMigrations() {
  const migrationsPath = path.join(__dirname, "../../database/migrations");

  try {
    logger.info("Running database migrations...");

    // Read all migration files
    const files = await fs.readdir(migrationsPath);
    const sqlFiles = files.filter((f) => f.endsWith(".sql")).sort();

    logger.debug(`Found ${sqlFiles.length} migration files`);

    // Execute each migration
    for (const file of sqlFiles) {
      const filePath = path.join(migrationsPath, file);
      const sql = await fs.readFile(filePath, "utf8");

      logger.debug(`Executing migration: ${file}`);
      // Split on semicolons followed by newline or end of content to avoid splitting on semicolons inside strings
      const statements = sql
        .split(/;(?=[\r\n]|$)/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      for (const statement of statements) {
        await pool.query(statement);
      }

      logger.info(`Migration completed: ${file}`);
    }

    logger.info("All migrations completed successfully");
    return true;
  } catch (error) {
    logger.error("Migration failed", {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

async function runSeeds() {
  const seedsPath = path.join(__dirname, "../../database/seeds");

  try {
    // Check if database already has data
    const [rows] = await pool.query("SELECT COUNT(*) as count FROM roles");
    if (rows[0].count > 0) {
      logger.info("Database already seeded, skipping seed process");
      return true;
    }

    logger.info("Running database seeds...");

    const files = await fs.readdir(seedsPath);
    const sqlFiles = files.filter((f) => f.endsWith(".sql")).sort();

    logger.debug(`Found ${sqlFiles.length} seed files`);

    // Execute each seed
    for (const file of sqlFiles) {
      const filePath = path.join(seedsPath, file);
      const sql = await fs.readFile(filePath, "utf8");

      logger.debug(`Executing seed: ${file}`);

      // Split on semicolons followed by newline or end of content to avoid splitting on semicolons inside strings
      const statements = sql
        .split(/;(?=[\r\n]|$)/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      for (const statement of statements) {
        await pool.query(statement);
      }

      logger.info(`Seed completed: ${file}`);
    }

    logger.info("All seeds completed successfully");
    return true;
  } catch (error) {
    logger.error("Seeding failed", {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

module.exports = {
  runMigrations,
  runSeeds,
};
