-- =====================================================
-- Additional changes by Vo Thanh Phong
-- Issue #10 - Normalize Service Package Vehicle Type
-- =====================================================

ALTER TABLE service_packages
ADD seat_count INT NULL;

ALTER TABLE service_packages
ADD motorbike_group NVARCHAR(30) NULL;

--Chuyển dữ liệu 
-- CAR 4 seats
UPDATE service_packages
SET
    vehicle_type = 'CAR',
    seat_count = 4
WHERE vehicle_type = 'CAR_4';

-- CAR 7 seats
UPDATE service_packages
SET
    vehicle_type = 'CAR',
    seat_count = 7
WHERE vehicle_type = 'CAR_7';

-- BIKE UNDER 175
UPDATE service_packages
SET
    vehicle_type = 'BIKE',
    motorbike_group = 'UNDER_175'
WHERE vehicle_type = 'BIKE_UNDER_175';

-- BIKE OVER 175
UPDATE service_packages
SET
    vehicle_type = 'BIKE',
    motorbike_group = 'OVER_175'
WHERE vehicle_type = 'BIKE_OVER_175';

-- BIKE ELECTRIC
UPDATE service_packages
SET
    vehicle_type = 'BIKE',
    motorbike_group = 'ELECTRIC'
WHERE vehicle_type = 'BIKE_ELECTRIC';