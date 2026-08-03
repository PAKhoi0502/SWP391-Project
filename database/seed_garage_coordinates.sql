-- =====================================================
-- Seed real, distinct latitude/longitude for the 2 existing garages
-- so the "nearest garage" feature (VietMap Matrix API) has meaningful
-- data to sort by. Safe to re-run.
-- =====================================================

UPDATE garages
SET latitude = 10.7729000, longitude = 106.6984000
WHERE garage_code = 'G01'; -- Garage District 1, 123 Le Loi, Q1

UPDATE garages
SET latitude = 10.8508000, longitude = 106.8283000
WHERE garage_code = 'G02'; -- AutoWash Q9, 68 duong N12, P.Long Binh
GO
