const mysql = require("mysql2/promise");
const logger = require("./logger");
require("dotenv").config();

const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  port: process.env.DB_PORT || 3306,
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "flowbuilder",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

const pool = mysql.createPool(dbConfig);

async function testConnection() {
  try {
    const connection = await pool.getConnection();
    logger.info("Database connected successfully");
    connection.release();
    return true;
  } catch (error) {
    logger.error("Database connection failed", {
      error: error.message,
      stack: error.stack,
    });
    return false;
  }
}

async function getConnection() {
  try {
    return await pool.getConnection();
  } catch (error) {
    logger.error("Error getting database connection", {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

// Execute query with logging
async function query(sql, params) {
  const startTime = Date.now();

  try {
    const [results] = await pool.execute(sql, params);
    const duration = Date.now() - startTime;

    logger.logSQL(sql, params, duration);

    return results;
  } catch (error) {
    const duration = Date.now() - startTime;

    logger.error("SQL Query Failed", {
      query: sql,
      params,
      duration: `${duration}ms`,
      error: error.message,
      sqlMessage: error.sqlMessage,
      code: error.code,
    });

    throw error;
  }
}

module.exports = {
  pool,
  testConnection,
  getConnection,
  query,
};
