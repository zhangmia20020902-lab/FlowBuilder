-- Category IDs: 1=Concrete, 2=Steel, 3=Electrical, 4=Plumbing, 5=HVAC, 6=General
INSERT INTO materials (company_id, name, sku, unit, category_id) VALUES 
-- Concrete materials (category_id = 1)
(1, 'Ready-Mix Concrete (3000 PSI)', 'CONC-3000', 'cubic meter', 1),
(1, 'Ready-Mix Concrete (4000 PSI)', 'CONC-4000', 'cubic meter', 1),
(1, 'Concrete Block 8x8x16', 'BLOCK-8816', 'piece', 1),
-- Steel materials (category_id = 2)
(1, 'Rebar #4 (1/2 inch)', 'REBAR-4', 'piece', 2),
(1, 'Rebar #5 (5/8 inch)', 'REBAR-5', 'piece', 2),
(1, 'Steel Beam I-Beam 8"', 'BEAM-8', 'piece', 2),
(1, 'Steel Column 12x12', 'COL-12', 'piece', 2),
-- Electrical materials (category_id = 3)
(1, 'Electrical Wire 14 AWG', 'WIRE-14', 'meter', 3),
(1, 'Electrical Wire 12 AWG', 'WIRE-12', 'meter', 3),
(1, 'Circuit Breaker 20A', 'CB-20A', 'piece', 3),
(1, 'LED Light Fixture', 'LED-FIX', 'piece', 3),
-- Plumbing materials (category_id = 4)
(1, 'PVC Pipe 4 inch', 'PVC-4', 'meter', 4),
(1, 'PVC Pipe 2 inch', 'PVC-2', 'meter', 4),
(1, 'Copper Pipe 3/4 inch', 'COPPER-34', 'meter', 4),
(1, 'Toilet Fixture Standard', 'TOILET-STD', 'piece', 4),
-- HVAC materials (category_id = 5)
(1, 'Air Conditioning Unit 2 Ton', 'AC-2TON', 'piece', 5),
(1, 'Air Conditioning Unit 3 Ton', 'AC-3TON', 'piece', 5),
(1, 'Ductwork Galvanized 12"', 'DUCT-12', 'meter', 5),
(1, 'Thermostat Digital', 'THERMO-DIG', 'piece', 5),
-- General materials (category_id = 6)
(1, 'Cement Portland Type I', 'CEM-PORT1', 'bag', 6);


