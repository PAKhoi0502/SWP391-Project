-- =====================================================
-- Fix: wash bay capacity check under-counted guest walk-in bookings
-- (countOverlappingBookingsByGarageAndVehicleType relied on an INNER JOIN
-- to vehicles, which silently excluded bookings with a NULL vehicle_id).
-- Store the vehicle type directly on the booking so occupancy can be
-- counted without depending on a linked vehicle record.
-- =====================================================
ALTER TABLE bookings ADD vehicle_type VARCHAR(30) NULL;
GO

UPDATE b
SET b.vehicle_type = sp.vehicle_type
FROM bookings b
JOIN service_packages sp ON sp.id = b.service_package_id
WHERE b.vehicle_type IS NULL;
GO
