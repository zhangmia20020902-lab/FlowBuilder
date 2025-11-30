CREATE TABLE IF NOT EXISTS rfq_suppliers (
  rfq_id INT NOT NULL,
  supplier_id INT NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  notified_at TIMESTAMP NULL,
  responded_at TIMESTAMP NULL,
  PRIMARY KEY (rfq_id, supplier_id),
  FOREIGN KEY (rfq_id) REFERENCES rfqs(id) ON DELETE CASCADE,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE,
  INDEX idx_rfq_supplier_status (rfq_id, status)
) COMMENT = 'Tracks which suppliers received an RFQ and their response status';

