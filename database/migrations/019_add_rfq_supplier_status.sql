-- Add status tracking columns to rfq_suppliers table
ALTER TABLE rfq_suppliers 
ADD COLUMN status VARCHAR(50) DEFAULT 'pending' AFTER supplier_id,
ADD COLUMN notified_at TIMESTAMP NULL AFTER status,
ADD COLUMN responded_at TIMESTAMP NULL AFTER notified_at;

-- Add index for status queries
ALTER TABLE rfq_suppliers ADD INDEX idx_rfq_supplier_status (rfq_id, status);

-- Add comment for documentation
ALTER TABLE rfq_suppliers COMMENT = 'Tracks which suppliers received an RFQ and their response status';


