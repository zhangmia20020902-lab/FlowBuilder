CREATE TABLE IF NOT EXISTS pos (
  id INT PRIMARY KEY AUTO_INCREMENT,
  quote_id INT NOT NULL,
  status VARCHAR(50) DEFAULT 'issued', -- 'issued', 'confirmed', 'delivered', 'paid', 'cancelled'
  final_amount DECIMAL(15, 2) NOT NULL,
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE RESTRICT,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
);
