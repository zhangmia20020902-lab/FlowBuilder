-- Password for all users: password123
-- Properly hashed with bcrypt (salt rounds: 10)
INSERT INTO users (role_id, company_id, name, email, password) VALUES 
(1, 1, 'Admin User', 'admin@buildright.com', '$2a$10$jTWB6ZGs7N88JewZXwe2AO8Oh11o1sSmrIdakCyO3XtviAD6C1x1K'),
(2, 1, 'Construction Admin', 'admin.construction@buildright.com', '$2a$10$IFa/xDFDGDk6aI.ojdfvyux3VUbA0JEzbcB/X.Cy7XtCnS1kXRp4S'),
(3, 2, 'Supplier User', 'supplier@materials.com', '$2a$10$w92ndKLCivwFsRZ97832COveE6hKOhUAqYgDDBdZNbIHZaeGHDyxy');

