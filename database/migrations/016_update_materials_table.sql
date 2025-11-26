-- Add category_id column to materials table
ALTER TABLE materials ADD COLUMN category_id INT NULL AFTER unit;

-- Create temporary mapping from category strings to IDs
-- This will be handled by the seed data first

-- Add foreign key constraint
ALTER TABLE materials ADD CONSTRAINT fk_materials_category 
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE SET NULL;

-- Note: Existing category column will be kept for data migration
-- It can be removed later after data is migrated


