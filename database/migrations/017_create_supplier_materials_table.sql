-- Migration: Create supplier_materials junction table
-- Tracks which suppliers provide which materials (derived from ETL transactions)

CREATE TABLE IF NOT EXISTS supplier_materials (
  supplier_id INT NOT NULL,
  material_id INT NOT NULL,
  last_price DECIMAL(12, 2) NULL,
  last_transaction_date DATE NULL,
  transaction_count INT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (supplier_id, material_id),
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
  FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE,
  INDEX idx_supplier_materials_supplier (supplier_id),
  INDEX idx_supplier_materials_material (material_id)
) COMMENT = 'Junction table tracking supplier-material relationships from ETL data';
