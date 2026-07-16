export const VEHICLE_TYPES = ['CAR', 'BIKE']

export const ENGINE_TYPES = ['GASOLINE', 'ELECTRIC', 'HYBRID', 'DIESEL']

// Must match exactly the motorbike_group values stored in the
// service_packages table (see database/migration_v41_normalize_service_package_vehicle_type.sql).
// This is a fixed list of codes, not free text, to avoid mismatches
// between customer vehicles and service packages when matching in BookingServiceImpl.
export const MOTORBIKE_GROUPS = [
  { value: 'UNDER_175', label: 'Under 175cc (standard & common scooters)' },
  { value: 'OVER_175', label: 'Over 175cc (large displacement)' },
  { value: 'ELECTRIC', label: 'Electric motorbike' },
]
