CREATE TABLE IF NOT EXISTS quotes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  rfq_id INT NOT NULL,
  supplier_id INT NOT NULL,
  duration INT, -- 報價有效期 (天)
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'accepted', 'rejected', 'expired'
  total_amount DECIMAL(15, 2) DEFAULT 0.00,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (rfq_id) REFERENCES rfqs(id) ON DELETE CASCADE,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE CASCADE
);

