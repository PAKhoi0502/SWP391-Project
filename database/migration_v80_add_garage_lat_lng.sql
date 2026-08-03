-- =====================================================
-- Garages: add latitude/longitude so the customer dashboard can
-- suggest the nearest garage via the VietMap Matrix API.
-- Nullable — existing garages have no coordinates until an admin
-- fills them in via the garage edit form.
-- =====================================================

ALTER TABLE garages ADD latitude DECIMAL(10, 7) NULL;
GO

ALTER TABLE garages ADD longitude DECIMAL(10, 7) NULL;
GO
