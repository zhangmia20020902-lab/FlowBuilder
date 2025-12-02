CREATE TABLE IF NOT EXISTS rfqs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  project_id INT NOT NULL,
<<<<<<< HEAD:database/migrations/009_create_rfqs_table.sql
  name VARCHAR(255) NOT NULL,
  deadline DATETIME NOT NULL,
  status VARCHAR(50) DEFAULT 'draft',
=======
  name VARCHAR(255) NOT NULL, -- e.g., "Steel Requirements for Phase 1"
  deadline TIMESTAMP NOT NULL,
  status VARCHAR(50) DEFAULT 'draft', -- 'draft', 'open', 'closed', 'awarded'
>>>>>>> ba8568d923d3b1fc7ba6b10f3874e96dea428fc6:database/migrations/008_create_rfqs_table.sql
  created_by INT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT,
  INDEX idx_rfq_status (status),
  INDEX idx_rfq_deadline (deadline)
) COMMENT = 'Request for Quotations - status: draft, open, closed';