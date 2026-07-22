-- Migration v70: Add operation_phase and care scheduling fields to support the
-- automated-wash + vehicle-care staff workflow.

-- ============================================================
-- 1. BOOKINGS: operation_phase + planned/actual timing columns
-- ============================================================
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('bookings') AND name = 'operation_phase')
    ALTER TABLE bookings ADD operation_phase NVARCHAR(30) NULL;
-- Valid values: WAITING_FOR_INTAKE, AUTOMATED_WASH, WAITING_FOR_CARE,
--               VEHICLE_CARE, FINAL_INSPECTION, READY_FOR_HANDOVER, DONE

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('bookings') AND name = 'planned_wash_start_at')
    ALTER TABLE bookings ADD planned_wash_start_at DATETIME2(6) NULL;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('bookings') AND name = 'planned_wash_end_at')
    ALTER TABLE bookings ADD planned_wash_end_at DATETIME2(6) NULL;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('bookings') AND name = 'planned_care_start_at')
    ALTER TABLE bookings ADD planned_care_start_at DATETIME2(6) NULL;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('bookings') AND name = 'planned_care_end_at')
    ALTER TABLE bookings ADD planned_care_end_at DATETIME2(6) NULL;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('bookings') AND name = 'care_started_at')
    ALTER TABLE bookings ADD care_started_at DATETIME2(6) NULL;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('bookings') AND name = 'care_completed_at')
    ALTER TABLE bookings ADD care_completed_at DATETIME2(6) NULL;

-- ============================================================
-- 2. SERVICE_PACKAGE_STEPS: execution_phase + duration_minutes
-- ============================================================
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('service_package_steps') AND name = 'execution_phase')
    ALTER TABLE service_package_steps ADD execution_phase NVARCHAR(30) NULL;
-- Valid values: INTAKE_INSPECTION, AUTOMATED_WASH, VEHICLE_CARE, FINAL_INSPECTION

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('service_package_steps') AND name = 'duration_minutes')
    ALTER TABLE service_package_steps ADD duration_minutes INT NULL DEFAULT 0;

-- ============================================================
-- 3. BOOKING_SERVICE_STEPS: execution_phase + duration_minutes
-- ============================================================
IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('booking_service_steps') AND name = 'execution_phase')
    ALTER TABLE booking_service_steps ADD execution_phase NVARCHAR(30) NULL;

IF NOT EXISTS (
    SELECT 1 FROM sys.columns
    WHERE object_id = OBJECT_ID('booking_service_steps') AND name = 'duration_minutes')
    ALTER TABLE booking_service_steps ADD duration_minutes INT NULL DEFAULT 0;

-- ============================================================
-- 4. BOOKING_ASSIGNED_STAFF: composite index for overlap queries
--    (status column and base columns already exist from v36)
-- ============================================================
-- Drop old single-column index if it exists to avoid duplication
IF EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('booking_assigned_staff') AND name = 'IX_bas_staff_time')
    DROP INDEX IX_bas_staff_time ON booking_assigned_staff;

-- Replace with a more selective composite index that includes status
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('booking_assigned_staff') AND name = 'IX_bas_staff_status_time')
    CREATE INDEX IX_bas_staff_status_time
    ON booking_assigned_staff (staff_profile_id, status, assigned_from, assigned_to);

-- ============================================================
-- 5. Backfill: existing CONFIRMED/IN_PROGRESS bookings get a
--    sensible operation_phase so they are not left NULL.
--    Wrapped in EXEC sp_executesql to avoid batch compilation
--    errors on fresh databases where the columns were just added.
-- ============================================================
EXEC sp_executesql N'UPDATE bookings SET operation_phase = ''WAITING_FOR_INTAKE'' WHERE operation_phase IS NULL AND status = ''CONFIRMED''';
EXEC sp_executesql N'UPDATE bookings SET operation_phase = ''AUTOMATED_WASH'' WHERE operation_phase IS NULL AND status = ''IN_PROGRESS''';
EXEC sp_executesql N'UPDATE bookings SET operation_phase = ''DONE'' WHERE operation_phase IS NULL AND status IN (''COMPLETED'', ''CANCELED'', ''NO_SHOW'')';
