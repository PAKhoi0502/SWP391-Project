-- =====================================================
-- Staff Profiles: fixed salary (admin-managed)
-- =====================================================

ALTER TABLE staff_profiles
ADD salary DECIMAL(18,2) NOT NULL
CONSTRAINT DF_staff_profiles_salary DEFAULT 0;
GO
