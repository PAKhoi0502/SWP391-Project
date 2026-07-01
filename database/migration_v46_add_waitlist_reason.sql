-- =====================================================
-- Additional changes by Phan Hoang Thong
-- Issue #30 Waitlist: Add reason column (NO_BAY | NO_CARE_STAFF)
-- =====================================================
ALTER TABLE waitlists ADD reason NVARCHAR(30) NOT NULL DEFAULT 'NO_BAY';