-- =====================================================
-- Additional changes by Phan Hoang Thong
-- Issue #18 Complete service and release resources
-- =====================================================
ALTER TABLE bookings ADD completed_at DATETIME2(0) NULL;