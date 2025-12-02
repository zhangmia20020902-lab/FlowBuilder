-- Seed client companies (type='client')
INSERT INTO companies (name, type, address) VALUES 
('FlowBuilder Construction Co.', 'client', '123 Construction Ave, Taipei, Taiwan'),
('Taiwan Building Materials Ltd.', 'client', '456 Materials Road, Taichung, Taiwan');

-- Seed supplier companies (type='supplier') - these are the basic demo suppliers
INSERT INTO companies (id, name, type, address, email, trade_specialty) VALUES 
(100, 'Premium Concrete Suppliers', 'supplier', '123 Construction Ave, Taipei, Taiwan', 'admin@premiumconcrete.com', 'Concrete'),
(101, 'Steel Masters Ltd.', 'supplier', '234 Construction Ave, Taipei, Taiwan', 'admin@steelmasters.com', 'Steel'),
(102, 'ElectriTech Solutions', 'supplier', '345 Construction Ave, Taipei, Taiwan', 'admin@electritech.com', 'Electrical'),
(103, 'Pro Plumbing Supply', 'supplier', '456 Construction Ave, Taipei, Taiwan', 'admin@proplumbing.com', 'Plumbing'),
(104, 'HVAC Systems Taiwan', 'supplier', '567 Construction Ave, Taipei, Taiwan', 'admin@hvacsystems.com', 'HVAC');