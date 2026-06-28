-- =====================================================
-- Add paid_at column to bookings
-- Issue #20 Cash Payment
-- =====================================================

ALTER TABLE bookings
ADD paid_at DATETIME2(0) NULL;