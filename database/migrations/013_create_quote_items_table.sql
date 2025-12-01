-- Requires: 012_create_quotes_table.sql, 008_create_materials_table.sql

CREATE TABLE IF NOT EXISTS quote_items (
  id INT PRIMARY KEY AUTO_INCREMENT,
  quote_id INT NOT NULL,
  material_id INT NOT NULL,
  price DECIMAL(10, 2) NOT NULL,
  quantity INT NOT NULL,
  discount_rate DECIMAL(5, 2) DEFAULT 0,
  original_unit_price DECIMAL(12, 2) NULL,
  total_price DECIMAL(14, 2) NULL,
  external_ref VARCHAR(20) NULL,
  status VARCHAR(50) DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE,
  FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE,
  INDEX idx_quote_items_external_ref (external_ref)
);

