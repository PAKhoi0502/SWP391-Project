/* =========================================================
   Migration V74 - One exception report per booking

   Safe to run repeatedly on SQL Server.
========================================================= */

IF OBJECT_ID('dbo.booking_exception_reports', 'U') IS NULL
    THROW 51074, 'Migration V74 requires dbo.booking_exception_reports. Run migration V73 first.', 1;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'UQ_booking_exception_reports_booking_id'
      AND object_id = OBJECT_ID('dbo.booking_exception_reports')
)
BEGIN
    -- Guard against pre-existing duplicates before adding the constraint.
    IF EXISTS (
        SELECT booking_id FROM dbo.booking_exception_reports
        GROUP BY booking_id HAVING COUNT(*) > 1
    )
        THROW 51075, 'Cannot add unique constraint: duplicate booking_id rows exist in booking_exception_reports.', 1;

    ALTER TABLE dbo.booking_exception_reports
        ADD CONSTRAINT UQ_booking_exception_reports_booking_id UNIQUE (booking_id);
END
GO
