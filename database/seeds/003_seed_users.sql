-- Password for all users: password123
-- Properly hashed with bcrypt (salt rounds: 10)

-- Admin and client users
INSERT INTO users (role_id, company_id, name, email, password) VALUES 
(1, 1, 'Admin User', 'admin@flowbuilder.com', '$2a$10$jTWB6ZGs7N88JewZXwe2AO8Oh11o1sSmrIdakCyO3XtviAD6C1x1K'),
(2, 1, 'Construction Admin', 'admin.construction@flowbuilder.com', '$2a$10$IFa/xDFDGDk6aI.ojdfvyux3VUbA0JEzbcB/X.Cy7XtCnS1kXRp4S'),
(3, 2, 'Supplier User', 'supplier@materials.com', '$2a$10$w92ndKLCivwFsRZ97832COveE6hKOhUAqYgDDBdZNbIHZaeGHDyxy');

-- Supplier users for demo supplier companies (IDs 100-104)
-- Each supplier company needs a user account to login and submit quotes
-- role_id=3 is the Supplier role from 001_seed_roles.sql
INSERT INTO users (role_id, company_id, name, email, password) VALUES 
(3, 100, 'Premium Concrete Admin', 'admin@premiumconcrete.com', '$2a$10$jTWB6ZGs7N88JewZXwe2AO8Oh11o1sSmrIdakCyO3XtviAD6C1x1K'),
(3, 101, 'Steel Masters Admin', 'admin@steelmasters.com', '$2a$10$jTWB6ZGs7N88JewZXwe2AO8Oh11o1sSmrIdakCyO3XtviAD6C1x1K'),
(3, 102, 'ElectriTech Admin', 'admin@electritech.com', '$2a$10$jTWB6ZGs7N88JewZXwe2AO8Oh11o1sSmrIdakCyO3XtviAD6C1x1K'),
(3, 103, 'Pro Plumbing Admin', 'admin@proplumbing.com', '$2a$10$jTWB6ZGs7N88JewZXwe2AO8Oh11o1sSmrIdakCyO3XtviAD6C1x1K'),
(3, 104, 'HVAC Systems Admin', 'admin@hvacsystems.com', '$2a$10$jTWB6ZGs7N88JewZXwe2AO8Oh11o1sSmrIdakCyO3XtviAD6C1x1K');

