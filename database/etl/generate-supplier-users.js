/**
 * Supplier User Generation Script
 * Generates seed file to create user accounts for ETL supplier companies
 * This enables suppliers to login to the system with their own accounts
 *
 * Note: Companies are now created by transform-etl-to-seeds.js with type='supplier'
 * This script only generates user accounts that link to those companies
 *
 * Usage: node database/etl/generate-supplier-users.js
 */

const fs = require("fs");
const path = require("path");

// Paths
const SEEDS_DIR = path.join(__dirname, "..", "seeds");
const COMPANIES_SEED = path.join(SEEDS_DIR, "011_seed_etl_companies.sql");

// Configuration
const SUPPLIER_ROLE_ID = 3; // Supplier role from 001_seed_roles.sql
const BATCH_SIZE = 500; // Batch size for INSERT statements

// Password: password123 (bcrypt hashed, same as other seed users)
const PASSWORD_HASH =
  "$2a$10$jTWB6ZGs7N88JewZXwe2AO8Oh11o1sSmrIdakCyO3XtviAD6C1x1K";

// Helper function to escape SQL strings
function escapeSql(str) {
  if (str === null || str === undefined || str === "NULL") return "NULL";
  return "'" + String(str).replace(/'/g, "''") + "'";
}

// Parse the companies seed file to extract supplier company data
function parseCompaniesSeed(content) {
  const companies = [];

  // Match each VALUES row: (id, name, 'supplier', address, phone, email, trade_specialty, description, notes)
  const regex = /\((\d+),\s*'([^']*(?:''[^']*)*)',\s*'supplier',/g;

  let match;
  while ((match = regex.exec(content)) !== null) {
    const [_, id, name] = match;
    companies.push({
      id: parseInt(id),
      name: name.replace(/''/g, "'"),
    });
  }

  return companies;
}

// Generate users seed file
function generateUsersSeed(companies) {
  console.log("Generating supplier users seed...");

  const lines = [
    "-- Seed: User Accounts for ETL Supplier Companies",
    "-- Creates user accounts for each supplier company to enable them to login",
    "-- User IDs match Company IDs (1000-1499) for easy reference",
    "-- role_id=3 is the Supplier role from 001_seed_roles.sql",
    "-- Password for all supplier users: password123",
    "",
    "-- Columns: id, role_id, company_id, name, email, password",
    "INSERT INTO users (id, role_id, company_id, name, email, password) VALUES",
  ];

  const values = companies.map((company, index) => {
    const isLast = index === companies.length - 1;
    const suffix = isLast ? ";" : ",";
    // Use standardized email format: supplier{id}@flowbuilder.com
    // This avoids duplicate email issues and clearly identifies supplier accounts
    const email = `supplier${company.id}@flowbuilder.com`;
    return `(${company.id}, ${SUPPLIER_ROLE_ID}, ${company.id}, ${escapeSql(
      company.name
    )}, ${escapeSql(email)}, '${PASSWORD_HASH}')${suffix}`;
  });

  lines.push(...values);

  const outputPath = path.join(SEEDS_DIR, "020_seed_etl_supplier_users.sql");
  fs.writeFileSync(outputPath, lines.join("\n"));

  console.log(`  Generated ${companies.length} user records`);
  console.log(`  Output: ${outputPath}`);
}

// Main execution
function main() {
  console.log("=== Supplier User Generation ===\n");

  // Read companies seed file
  if (!fs.existsSync(COMPANIES_SEED)) {
    console.error(`Error: Companies seed file not found: ${COMPANIES_SEED}`);
    console.error("Please run transform-etl-to-seeds.js first");
    process.exit(1);
  }

  const content = fs.readFileSync(COMPANIES_SEED, "utf8");
  const companies = parseCompaniesSeed(content);

  console.log(`Found ${companies.length} supplier companies in seed file\n`);

  if (companies.length === 0) {
    console.error("Error: No supplier companies found in seed file");
    process.exit(1);
  }

  // Generate seed files
  generateUsersSeed(companies);

  console.log("\n=== Generation Complete ===");
  console.log("\nSuppliers can now login with:");
  console.log(
    "  Email: supplier{id}@flowbuilder.com (e.g., supplier1000@flowbuilder.com)"
  );
  console.log("  Password: password123");
  console.log(
    "\nTo apply these seeds, run the database migration/seed process."
  );
}

main();
