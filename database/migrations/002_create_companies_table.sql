CREATE TABLE IF NOT EXISTS companies (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) DEFAULT 'client' COMMENT 'Company type: client or supplier',
  address TEXT,
  phone VARCHAR(50) NULL,
  email VARCHAR(255) NULL,
  trade_specialty VARCHAR(100) NULL COMMENT 'For suppliers: their trade specialty',
  description TEXT NULL COMMENT 'For suppliers: company description',
  notes TEXT NULL COMMENT 'Internal notes about the company',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_companies_type (type)
);

