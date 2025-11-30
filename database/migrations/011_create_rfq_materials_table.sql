CREATE TABLE IF NOT EXISTS rfq_materials (
  rfq_id INT NOT NULL,
  material_id INT NOT NULL,
  quantity INT NOT NULL,
  PRIMARY KEY (rfq_id, material_id),
  FOREIGN KEY (rfq_id) REFERENCES rfqs(id) ON DELETE CASCADE,
  FOREIGN KEY (material_id) REFERENCES materials(id) ON DELETE CASCADE
);

