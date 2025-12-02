CREATE TABLE IF NOT EXISTS rfq_suppliers (
  rfq_id INT NOT NULL,
  company_id INT NOT NULL COMMENT 'The supplier company receiving the RFQ',
  status VARCHAR(50) DEFAULT 'pending',
  notified_at DATETIME NULL,
  responded_at DATETIME NULL,
  PRIMARY KEY (rfq_id, company_id),
  FOREIGN KEY (rfq_id) REFERENCES rfqs(id) ON DELETE CASCADE,
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE,
  INDEX idx_rfq_supplier_status (rfq_id, status)
) COMMENT = 'Tracks which supplier companies received an RFQ and their response status';

