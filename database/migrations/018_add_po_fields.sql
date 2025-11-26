ALTER TABLE pos ADD COLUMN notes TEXT AFTER status;
ALTER TABLE pos ADD COLUMN cancelled_at TIMESTAMP NULL AFTER notes;

ALTER TABLE pos ADD INDEX idx_status (status);


