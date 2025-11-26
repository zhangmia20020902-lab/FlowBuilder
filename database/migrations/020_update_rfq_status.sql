-- Ensure RFQ status column supports all required statuses
-- No schema change needed as VARCHAR(50) already supports 'draft', 'open', 'closed'

-- Add index on status for better query performance
ALTER TABLE rfqs ADD INDEX idx_rfq_status (status);

-- Add index on deadline for deadline-based queries
ALTER TABLE rfqs ADD INDEX idx_rfq_deadline (deadline);

-- Add comment for documentation
ALTER TABLE rfqs COMMENT = 'Request for Quotations - status: draft, open, closed';


