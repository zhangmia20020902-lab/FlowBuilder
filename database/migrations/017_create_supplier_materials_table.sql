-- Migration: Create company_materials junction table
-- Tracks which supplier companies provide which materials (derived from ETL transactions)

CREATE TABLE IF NOT EXISTS company_materials (
  company_id INT NOT NULL COMMENT 'The supplier company',
  material_id INT NOT NULL,
  last_price DECIMAL(12, 2) NULL,
  last_transaction_date DATE NULL,
  transaction_count INT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (company_id, material_id),
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE,
  INDEX idx_company_materials_company (company_id),
  INDEX idx_company_materials_material (material_id)
) COMMENT = 'Junction table tracking supplier company-material relationships from ETL data';
