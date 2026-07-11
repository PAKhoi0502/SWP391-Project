-- =====================================================
-- Fix: Admin "Tạo gói dịch vụ" form used 'MOTORBIKE' as the vehicle type
-- value (servicePackageApi.js VEHICLE_TYPES), but every other part of the
-- system (vehicles, wash_bays, and the original MAIN motorbike package from
-- migration_v41) uses 'BIKE'. Packages created with 'MOTORBIKE' never
-- matched any real vehicle, so they were invisible in the booking flow.
-- =====================================================
UPDATE service_packages
SET vehicle_type = 'BIKE'
WHERE vehicle_type = 'MOTORBIKE';
