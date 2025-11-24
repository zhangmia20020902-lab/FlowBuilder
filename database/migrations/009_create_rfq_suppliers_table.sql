CREATE TABLE IF NOT EXISTS rfq_suppliers (
  rfq_id INT NOT NULL,
  supplier_id INT NOT NULL,
  PRIMARY KEY (rfq_id, supplier_id),
  FOREIGN KEY (rfq_id) REFERENCES rfqs(id) ON DELETE CASCADE,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE
);

