-- =====================================================
-- Special Days: configurable surcharge percentage per special day
-- Previously hardcoded to 30% in code (SpecialDayServiceImpl) — now admin-editable.
-- Stored as a whole-number percentage (e.g. 30.00 = 30%), not a fraction.
-- =====================================================

ALTER TABLE special_days
ADD surcharge_rate DECIMAL(5, 2) NOT NULL
CONSTRAINT DF_special_days_surcharge_rate DEFAULT 30.00;
GO
