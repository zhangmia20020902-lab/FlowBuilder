-- Seed company partnerships (client company -> supplier company relationships)
INSERT INTO company_partnerships (source_company_id, target_company_id, notes, status) VALUES 
(1, 100, 'Reliable concrete supplier, good pricing', 'active'),
(1, 101, 'Best steel quality in region', 'active'),
(1, 102, 'Licensed electrical contractor', 'active'),
(1, 103, 'Fast delivery, good customer service', 'active'),
(1, 104, 'Specialized in commercial HVAC', 'active');

