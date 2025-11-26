CREATE TABLE IF NOT EXISTS companies (
  id INT PRIMARY KEY AUTO_INCREMENT, -- 對應圖片的 company_id
  name VARCHAR(255) NOT NULL,
  description TEXT,                  -- New
  address TEXT,
  phone VARCHAR(50),                 -- New
  email VARCHAR(100),                -- New
  comments TEXT,                     -- New
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

