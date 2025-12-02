-- Company Partnerships: Links client companies to supplier companies
-- source_company_id = the client/buyer company
-- target_company_id = the supplier company they partner with
CREATE TABLE IF NOT EXISTS company_partnerships (
  source_company_id INT NOT NULL COMMENT 'The client company',
  target_company_id INT NOT NULL COMMENT 'The supplier company',
  notes TEXT,
  status VARCHAR(50) DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (source_company_id, target_company_id),
  FOREIGN KEY (source_company_id) REFERENCES companies(id) ON DELETE CASCADE,
  FOREIGN KEY (target_company_id) REFERENCES companies(id) ON DELETE CASCADE
);

