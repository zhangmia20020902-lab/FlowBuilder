CREATE TABLE IF NOT EXISTS materials (
  id INT PRIMARY KEY AUTO_INCREMENT,
  company_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  sku VARCHAR(100),       -- 庫存單位 (Stock Keeping Unit)
  unit VARCHAR(50) NOT NULL, -- e.g., 'kg', 'm3', 'bag'
  category VARCHAR(100),
  
  -- 統計欄位
  price_avg DECIMAL(10, 2) DEFAULT 0,
  price_stdev DECIMAL(10, 2) DEFAULT 0,
  no_samples INT DEFAULT 0,

  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE
);

