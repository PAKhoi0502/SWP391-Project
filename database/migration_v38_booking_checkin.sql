-- =====================================================
-- Additional changes by Vo Thanh Phong
-- Issue #14 Staff Check-in Booking
-- =====================================================

ALTER TABLE bookings
ADD checked_in_at DATETIME2 NULL;