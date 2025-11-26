CREATE TABLE IF NOT EXISTS rfqs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  project_id INT NOT NULL,
  name VARCHAR(255) NOT NULL, -- e.g., "Steel Requirements for Phase 1"
  deadline TIMESTAMP NOT NULL,
  status VARCHAR(50) DEFAULT 'draft', -- 'draft', 'open', 'closed', 'awarded'
  created_by INT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE RESTRICT
);