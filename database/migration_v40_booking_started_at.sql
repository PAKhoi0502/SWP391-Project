-- =====================================================

-- Additional changes by Vo Thanh Phong

-- Issue #16 Start service 

-- =====================================================
ALTER TABLE bookings
ADD started_at DATETIME2(0) NULL;