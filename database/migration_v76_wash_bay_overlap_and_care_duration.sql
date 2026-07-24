-- Migration v76: Fix wash bay overlap window and derive care_staff_duration_minutes from steps
-- Compatible with SQL Server. Idempotent.

-- 1. Index on bookings.planned_wash_end_at to support the corrected wash bay overlap query
--    (COALESCE(planned_wash_end_at, end_time) > :startTime)
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.bookings')
      AND name = 'IX_bookings_planned_wash_end_at'
)
BEGIN
    CREATE INDEX IX_bookings_planned_wash_end_at
        ON dbo.bookings (planned_wash_end_at)
        WHERE planned_wash_end_at IS NOT NULL;
END;

-- 2. Backfill care_staff_duration_minutes from VEHICLE_CARE steps for existing packages.
--    Uses the sum of duration_minutes of steps with execution_phase = 'VEHICLE_CARE'.
--    Only updates packages that own their own steps (non-COMBO), where the derived value
--    differs from the stored value (avoids unnecessary writes).
UPDATE sp
SET sp.care_staff_duration_minutes = derived.care_minutes
FROM dbo.service_packages sp
INNER JOIN (
    SELECT
        sps.service_package_id,
        COALESCE(SUM(CASE WHEN UPPER(sps.execution_phase) = 'VEHICLE_CARE'
                          THEN COALESCE(sps.duration_minutes, 0)
                          ELSE 0 END), 0) AS care_minutes
    FROM dbo.service_package_steps sps
    GROUP BY sps.service_package_id
) derived ON derived.service_package_id = sp.id
WHERE UPPER(COALESCE(sp.service_type, '')) <> 'COMBO'
  AND derived.care_minutes <> COALESCE(sp.care_staff_duration_minutes, 0);
