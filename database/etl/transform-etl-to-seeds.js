/**
 * ETL Data Transformation Script
 * Transforms ETL companies, materials, and transactions into seed SQL files
 *
 * Usage: node database/etl/transform-etl-to-seeds.js
 */

const fs = require("fs");
const path = require("path");

// Paths
const ETL_DIR = path.join(__dirname);
const SEEDS_DIR = path.join(__dirname, "..", "seeds");

// ID mapping configuration - IDs start from 1000 to avoid collision with existing seeds
const SUPPLIER_ID_START = 1000;
const MATERIAL_ID_START = 1000;
const RFQ_ID_START = 1000;
const QUOTE_ID_START = 1000;
const QUOTE_ITEM_ID_START = 1000;
const PO_ID_START = 1000;

// Batch size for INSERT statements (to avoid MySQL packet size issues)
const BATCH_SIZE = 1000;

// Maps for ETL ID -> New ID
const companyIdMap = new Map(); // ETL company_id -> supplier_id
const materialIdMap = new Map(); // ETL material_id -> material_id

// Helper function to create batched INSERT statements
function createBatchedInserts(tableName, columns, values) {
  const lines = [];
  const insertPrefix = `INSERT INTO ${tableName} (${columns}) VALUES`;

  for (let i = 0; i < values.length; i += BATCH_SIZE) {
    const batch = values.slice(i, i + BATCH_SIZE);
    lines.push(insertPrefix);
    lines.push(batch.join(",\n") + ";");
    lines.push(""); // Empty line between batches
  }

  return lines;
}

// Trade specialty keyword mapping
function deriveTradeSpecialty(description) {
  const desc = (description || "").toLowerCase();

  if (desc.includes("concrete") || desc.includes("masonry")) return "Concrete";
  if (
    desc.includes("steel") ||
    desc.includes("metal") ||
    desc.includes("welding") ||
    desc.includes("fabrication")
  )
    return "Steel";
  if (desc.includes("electrical") || desc.includes("wiring"))
    return "Electrical";
  if (
    desc.includes("plumbing") ||
    desc.includes("pipe") ||
    desc.includes("water")
  )
    return "Plumbing";
  if (
    desc.includes("hvac") ||
    desc.includes("heating") ||
    desc.includes("cooling") ||
    desc.includes("ventilation")
  )
    return "HVAC";
  if (desc.includes("roofing") || desc.includes("cladding")) return "Roofing";
  if (
    desc.includes("timber") ||
    desc.includes("wood") ||
    desc.includes("lumber")
  )
    return "Timber";
  if (
    desc.includes("landscape") ||
    desc.includes("hardscape") ||
    desc.includes("garden")
  )
    return "Landscaping";
  if (
    desc.includes("excavation") ||
    desc.includes("earthwork") ||
    desc.includes("groundwork")
  )
    return "Earthworks";
  if (desc.includes("insulation") || desc.includes("coating"))
    return "Insulation";
  if (desc.includes("prefab") || desc.includes("modular"))
    return "Prefabrication";
  if (desc.includes("scaffold")) return "Scaffolding";
  if (
    desc.includes("aggregate") ||
    desc.includes("sand") ||
    desc.includes("gravel")
  )
    return "Aggregates";
  if (
    desc.includes("logistics") ||
    desc.includes("transport") ||
    desc.includes("delivery")
  )
    return "Logistics";

  return "General Construction";
}

// Escape single quotes for SQL
function escapeSql(str) {
  if (str === null || str === undefined || str === "NULL") return "NULL";
  return "'" + String(str).replace(/'/g, "''") + "'";
}

// Parse ETL SQL INSERT statements
function parseEtlInserts(sqlContent, tableName) {
  const rows = [];
  // Match INSERT statements - use lazy matching for VALUES content
  const regex = new RegExp(
    `INSERT INTO ${tableName}\\s*\\([^)]+\\)\\s*VALUES\\s*\\((.+?)\\);$`,
    "gim"
  );

  let match;
  while ((match = regex.exec(sqlContent)) !== null) {
    const valuesStr = match[1];
    // Parse values - handle quoted strings with commas and escaped quotes
    const values = [];
    let current = "";
    let inQuote = false;

    for (let i = 0; i < valuesStr.length; i++) {
      const char = valuesStr[i];
      const nextChar = valuesStr[i + 1];

      if (char === "'" && inQuote && nextChar === "'") {
        // Escaped quote inside string - keep both quotes
        current += "''";
        i++; // Skip next quote
      } else if (char === "'") {
        inQuote = !inQuote;
        current += char;
      } else if (char === "," && !inQuote) {
        values.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    values.push(current.trim()); // Push last value

    // Clean up values
    const cleanValues = values.map((v) => {
      v = v.trim();
      if (v.startsWith("'") && v.endsWith("'")) {
        return v.slice(1, -1).replace(/''/g, "'");
      }
      if (v === "NULL") return null;
      return v;
    });

    rows.push(cleanValues);
  }

  return rows;
}

// Transform ETL companies to supplier companies (unified model)
function transformCompanies() {
  console.log("Transforming ETL companies to supplier companies...");

  const etlContent = fs.readFileSync(
    path.join(ETL_DIR, "companies.sql"),
    "utf8"
  );
  const companies = parseEtlInserts(etlContent, "companies");

  let companyId = SUPPLIER_ID_START;
  const sqlLines = [
    "-- Seed: ETL Supplier Companies",
    "-- Transformed from ETL companies data with ID mapping starting from 1000",
    "-- type='supplier' distinguishes these from client companies",
    "",
    "-- Columns: id, name, type, address, phone, email, trade_specialty, description, notes",
    "INSERT INTO companies (id, name, type, address, phone, email, trade_specialty, description, notes) VALUES",
  ];

  const valueRows = [];

  companies.forEach((row, index) => {
    // ETL: company_id, name, description, address, phone, email, comments
    const [etlCompanyId, name, description, address, phone, email, comments] =
      row;

    companyIdMap.set(etlCompanyId, companyId);

    const tradeSpecialty = deriveTradeSpecialty(description);

    valueRows.push(
      `(${companyId}, ${escapeSql(name)}, 'supplier', ${escapeSql(
        address
      )}, ${escapeSql(phone)}, ${escapeSql(email)}, ${escapeSql(
        tradeSpecialty
      )}, ${escapeSql(description)}, ${escapeSql(comments)})`
    );

    companyId++;
  });

  sqlLines.push(valueRows.join(",\n") + ";");

  fs.writeFileSync(
    path.join(SEEDS_DIR, "011_seed_etl_companies.sql"),
    sqlLines.join("\n")
  );

  console.log(
    `  Transformed ${
      companies.length
    } ETL companies to supplier companies (IDs ${SUPPLIER_ID_START}-${
      companyId - 1
    })`
  );

  // Save ID map for reference
  fs.writeFileSync(
    path.join(ETL_DIR, "company_id_map.json"),
    JSON.stringify(Object.fromEntries(companyIdMap), null, 2)
  );
}

// Transform ETL materials
function transformMaterials() {
  console.log("Transforming ETL materials...");

  const etlContent = fs.readFileSync(
    path.join(ETL_DIR, "materials.sql"),
    "utf8"
  );
  const materials = parseEtlInserts(etlContent, "materials");

  let materialId = MATERIAL_ID_START;
  const sqlLines = [
    "-- Seed: ETL Materials with Pricing Statistics",
    "-- Transformed from ETL materials data with ID mapping starting from 1000",
    "-- company_id=1 is the system company",
    "-- category_id=6 is General category for all ETL materials",
    "",
    "-- Columns: id, company_id, name, sku, unit, category_id, price_avg, price_stdev, sample_count",
    "INSERT INTO materials (id, company_id, name, sku, unit, category_id, price_avg, price_stdev, sample_count) VALUES",
  ];

  const valueRows = [];

  materials.forEach((row, index) => {
    // ETL: material_id, Item, Unit, PriceAvg, PriceStdev, NoSamples
    const [etlMaterialId, item, unit, priceAvg, priceStdev, noSamples] = row;

    materialIdMap.set(etlMaterialId, materialId);

    valueRows.push(
      `(${materialId}, 1, ${escapeSql(item)}, ${escapeSql(
        etlMaterialId
      )}, ${escapeSql(unit)}, 6, ${priceAvg || "NULL"}, ${
        priceStdev || "NULL"
      }, ${noSamples || "NULL"})`
    );

    materialId++;
  });

  sqlLines.push(valueRows.join(",\n") + ";");

  fs.writeFileSync(
    path.join(SEEDS_DIR, "012_seed_etl_materials.sql"),
    sqlLines.join("\n")
  );

  console.log(
    `  Transformed ${materials.length} materials (IDs ${MATERIAL_ID_START}-${
      materialId - 1
    })`
  );

  // Save ID map for reference
  fs.writeFileSync(
    path.join(ETL_DIR, "material_id_map.json"),
    JSON.stringify(Object.fromEntries(materialIdMap), null, 2)
  );
}

// Transform ETL transactions to RFQ workflow
function transformTransactions() {
  console.log("Transforming ETL transactions to RFQ workflow...");

  const etlContent = fs.readFileSync(
    path.join(ETL_DIR, "transactions.sql"),
    "utf8"
  );
  const transactions = parseEtlInserts(etlContent, "transactions");

  console.log(`  Found ${transactions.length} transactions`);

  // Group transactions by supplier + month
  const groups = new Map(); // Key: "supplierId-YYYY-MM" -> transactions[]

  let skippedNoSupplier = 0;
  let skippedNoMaterial = 0;

  transactions.forEach((row) => {
    // ETL: transaction_id, company_id, material_id, quantity, price_per_unit, discount_rate, total_price, transaction_date, notes
    const [
      transactionId,
      etlCompanyId,
      etlMaterialId,
      quantity,
      pricePerUnit,
      discountRate,
      totalPrice,
      transactionDate,
      notes,
    ] = row;

    const supplierId = companyIdMap.get(etlCompanyId);
    const materialId = materialIdMap.get(etlMaterialId);

    if (!supplierId) {
      skippedNoSupplier++;
      return;
    }
    if (!materialId) {
      skippedNoMaterial++;
      return;
    }

    // Extract year-month from date
    const date = transactionDate ? transactionDate.substring(0, 7) : "2020-01"; // YYYY-MM
    const groupKey = `${supplierId}-${date}`;

    if (!groups.has(groupKey)) {
      groups.set(groupKey, []);
    }

    groups.get(groupKey).push({
      transactionId,
      supplierId,
      materialId,
      quantity: parseInt(quantity) || 1,
      pricePerUnit: parseFloat(pricePerUnit) || 0,
      discountRate: parseFloat(discountRate) || 0,
      totalPrice: parseFloat(totalPrice) || 0,
      transactionDate,
      notes,
    });
  });

  console.log(`  Grouped into ${groups.size} procurement cycles`);
  console.log(
    `  Skipped ${skippedNoSupplier} transactions with unmapped supplier`
  );
  console.log(
    `  Skipped ${skippedNoMaterial} transactions with unmapped material`
  );

  // Generate seed files
  let rfqId = RFQ_ID_START;
  let quoteId = QUOTE_ID_START;
  let quoteItemId = QUOTE_ITEM_ID_START;
  let poId = PO_ID_START;

  const rfqLines = [
    "-- Seed: Historical RFQs from ETL transactions",
    "-- Grouped by supplier + month",
    "",
    "INSERT INTO rfqs (id, project_id, name, deadline, status, created_by, created_at) VALUES",
  ];
  const rfqSuppliersLines = [
    "-- Seed: Historical RFQ-Supplier company associations",
    "",
    "INSERT INTO rfq_suppliers (rfq_id, company_id, status, notified_at, responded_at) VALUES",
  ];
  const rfqMaterialsLines = [
    "-- Seed: Historical RFQ-Material associations",
    "",
    "INSERT INTO rfq_materials (rfq_id, material_id, quantity) VALUES",
  ];
  const quotesLines = [
    "-- Seed: Historical Quotes from ETL transactions",
    "",
    "INSERT INTO quotes (id, rfq_id, company_id, duration, status, created_at) VALUES",
  ];
  const quoteItemsLines = [
    "-- Seed: Historical Quote Items from ETL transactions",
    "",
    "INSERT INTO quote_items (id, quote_id, material_id, price, quantity, discount_rate, original_unit_price, total_price, external_ref, status) VALUES",
  ];
  const posLines = [
    "-- Seed: Historical Purchase Orders from ETL transactions",
    "",
    "INSERT INTO pos (id, quote_id, status, notes, created_by, created_at) VALUES",
  ];

  const rfqValues = [];
  const rfqSuppliersValues = [];
  const rfqMaterialsValues = [];
  const quotesValues = [];
  const quoteItemsValues = [];
  const posValues = [];

  // Track unique materials per RFQ for rfq_materials
  const rfqMaterialQuantities = new Map(); // rfqId -> Map(materialId -> totalQuantity)

  groups.forEach((txns, groupKey) => {
    const [supplierId, yearMonth] =
      groupKey.split("-").length > 2
        ? [
            groupKey.substring(0, groupKey.lastIndexOf("-")),
            groupKey.substring(groupKey.lastIndexOf("-") - 4),
          ] // Handle supplier IDs with dashes
        : groupKey.split("-");

    // Parse properly
    const parts = groupKey.split("-");
    const supplierIdParsed = parseInt(parts[0]);
    const year = parts[1];
    const month = parts[2];
    const yearMonthStr = `${year}-${month}`;

    // Get supplier name from first transaction
    const firstTxn = txns[0];
    const deadline = txns.reduce(
      (latest, t) => (t.transactionDate > latest ? t.transactionDate : latest),
      txns[0].transactionDate
    );

    // RFQ
    const rfqName = `Historical - Supplier ${supplierIdParsed} - ${yearMonthStr}`;
    rfqValues.push(
      `(${rfqId}, 100, ${escapeSql(rfqName)}, '${
        deadline || "2020-12-31"
      } 23:59:59', 'closed', 1, '${deadline || "2020-01-01"} 00:00:00')`
    );

    // RFQ-Supplier
    rfqSuppliersValues.push(
      `(${rfqId}, ${supplierIdParsed}, 'responded', '${
        deadline || "2020-01-01"
      } 00:00:00', '${deadline || "2020-01-01"} 12:00:00')`
    );

    // Quote
    quotesValues.push(
      `(${quoteId}, ${rfqId}, ${supplierIdParsed}, 30, 'accepted', '${
        deadline || "2020-01-01"
      } 12:00:00')`
    );

    // Track materials for this RFQ
    const materialQuantityMap = new Map();

    // Quote Items + aggregate notes for PO
    const allNotes = [];
    txns.forEach((txn) => {
      // Calculate actual unit price after discount
      const actualPrice = txn.pricePerUnit * (1 - txn.discountRate / 100);

      quoteItemsValues.push(
        `(${quoteItemId}, ${quoteId}, ${txn.materialId}, ${actualPrice.toFixed(
          2
        )}, ${txn.quantity}, ${txn.discountRate}, ${txn.pricePerUnit}, ${
          txn.totalPrice
        }, ${escapeSql(txn.transactionId)}, 'accepted')`
      );

      // Track material quantities for rfq_materials
      const currentQty = materialQuantityMap.get(txn.materialId) || 0;
      materialQuantityMap.set(txn.materialId, currentQty + txn.quantity);

      if (txn.notes) {
        allNotes.push(txn.notes);
      }

      quoteItemId++;
    });

    // RFQ-Materials (aggregate unique materials)
    materialQuantityMap.forEach((qty, matId) => {
      rfqMaterialsValues.push(`(${rfqId}, ${matId}, ${qty})`);
    });

    // PO
    const poNotes =
      allNotes.length > 0 ? allNotes.slice(0, 3).join("; ") : null;
    posValues.push(
      `(${poId}, ${quoteId}, 'delivered', ${escapeSql(poNotes)}, 1, '${
        deadline || "2020-01-01"
      } 14:00:00')`
    );

    rfqId++;
    quoteId++;
    poId++;
  });

  // Write seed files with batched INSERTs
  const rfqContent = [
    "-- Seed: Historical RFQs from ETL transactions",
    "-- Grouped by supplier + month",
    "",
  ].concat(
    createBatchedInserts(
      "rfqs",
      "id, project_id, name, deadline, status, created_by, created_at",
      rfqValues
    )
  );
  fs.writeFileSync(
    path.join(SEEDS_DIR, "013_seed_etl_rfqs.sql"),
    rfqContent.join("\n")
  );

  const rfqMaterialsContent = [
    "-- Seed: Historical RFQ-Material associations",
    "",
  ].concat(
    createBatchedInserts(
      "rfq_materials",
      "rfq_id, material_id, quantity",
      rfqMaterialsValues
    )
  );
  fs.writeFileSync(
    path.join(SEEDS_DIR, "014_seed_etl_rfq_materials.sql"),
    rfqMaterialsContent.join("\n")
  );

  const rfqSuppliersContent = [
    "-- Seed: Historical RFQ-Supplier company associations",
    "",
  ].concat(
    createBatchedInserts(
      "rfq_suppliers",
      "rfq_id, company_id, status, notified_at, responded_at",
      rfqSuppliersValues
    )
  );
  fs.writeFileSync(
    path.join(SEEDS_DIR, "015_seed_etl_rfq_suppliers.sql"),
    rfqSuppliersContent.join("\n")
  );

  const quotesContent = [
    "-- Seed: Historical Quotes from ETL transactions",
    "",
  ].concat(
    createBatchedInserts(
      "quotes",
      "id, rfq_id, company_id, duration, status, created_at",
      quotesValues
    )
  );
  fs.writeFileSync(
    path.join(SEEDS_DIR, "016_seed_etl_quotes.sql"),
    quotesContent.join("\n")
  );

  const quoteItemsContent = [
    "-- Seed: Historical Quote Items from ETL transactions",
    "",
  ].concat(
    createBatchedInserts(
      "quote_items",
      "id, quote_id, material_id, price, quantity, discount_rate, original_unit_price, total_price, external_ref, status",
      quoteItemsValues
    )
  );
  fs.writeFileSync(
    path.join(SEEDS_DIR, "017_seed_etl_quote_items.sql"),
    quoteItemsContent.join("\n")
  );

  const posContent = [
    "-- Seed: Historical Purchase Orders from ETL transactions",
    "",
  ].concat(
    createBatchedInserts(
      "pos",
      "id, quote_id, status, notes, created_by, created_at",
      posValues
    )
  );
  fs.writeFileSync(
    path.join(SEEDS_DIR, "018_seed_etl_pos.sql"),
    posContent.join("\n")
  );

  console.log(
    `  Generated ${rfqValues.length} RFQs (IDs ${RFQ_ID_START}-${rfqId - 1})`
  );
  console.log(
    `  Generated ${quotesValues.length} Quotes (IDs ${QUOTE_ID_START}-${
      quoteId - 1
    })`
  );
  console.log(
    `  Generated ${
      quoteItemsValues.length
    } Quote Items (IDs ${QUOTE_ITEM_ID_START}-${quoteItemId - 1})`
  );
  console.log(
    `  Generated ${posValues.length} POs (IDs ${PO_ID_START}-${poId - 1})`
  );
  console.log(`  Using batch size of ${BATCH_SIZE} rows per INSERT`);
}

// Generate company_materials seed from transactions
function generateCompanyMaterials() {
  console.log("Generating company_materials relationships...");

  const etlContent = fs.readFileSync(
    path.join(ETL_DIR, "transactions.sql"),
    "utf8"
  );
  const transactions = parseEtlInserts(etlContent, "transactions");

  // Track company-material relationships
  const companyMaterials = new Map(); // "companyId-materialId" -> {lastPrice, lastDate, count}

  transactions.forEach((row) => {
    const [
      transactionId,
      etlCompanyId,
      etlMaterialId,
      quantity,
      pricePerUnit,
      discountRate,
      totalPrice,
      transactionDate,
      notes,
    ] = row;

    const companyId = companyIdMap.get(etlCompanyId);
    const materialId = materialIdMap.get(etlMaterialId);

    if (!companyId || !materialId) return;

    const key = `${companyId}-${materialId}`;
    const existing = companyMaterials.get(key);

    const price = parseFloat(pricePerUnit) || 0;
    const date = transactionDate || "2020-01-01";

    if (!existing || date > existing.lastDate) {
      companyMaterials.set(key, {
        companyId,
        materialId,
        lastPrice: price,
        lastDate: date,
        count: (existing?.count || 0) + 1,
      });
    } else {
      existing.count++;
    }
  });

  const values = [];
  companyMaterials.forEach((data) => {
    values.push(
      `(${data.companyId}, ${data.materialId}, ${data.lastPrice.toFixed(2)}, '${
        data.lastDate
      }', ${data.count})`
    );
  });

  const sqlContent = [
    "-- Seed: Company-Material relationships from ETL transactions",
    "-- Tracks which supplier companies provide which materials",
    "",
  ].concat(
    createBatchedInserts(
      "company_materials",
      "company_id, material_id, last_price, last_transaction_date, transaction_count",
      values
    )
  );

  fs.writeFileSync(
    path.join(SEEDS_DIR, "019_seed_etl_company_materials.sql"),
    sqlContent.join("\n")
  );

  console.log(`  Generated ${values.length} company-material relationships`);
}

// Main execution
function main() {
  console.log("=== ETL Data Transformation ===\n");

  // Ensure output directory exists
  if (!fs.existsSync(SEEDS_DIR)) {
    fs.mkdirSync(SEEDS_DIR, { recursive: true });
  }

  transformCompanies();
  transformMaterials();
  transformTransactions();
  generateCompanyMaterials();

  console.log("\n=== Transformation Complete ===");
  console.log(`Generated seed files in: ${SEEDS_DIR}`);
}

main();
