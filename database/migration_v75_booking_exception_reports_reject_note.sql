/* =========================================================
   Migration V75 - Exception reports: REJECTED status + admin note

   Safe to run repeatedly on SQL Server.
========================================================= */

IF OBJECT_ID('dbo.booking_exception_reports', 'U') IS NULL
    THROW 51076, 'Migration V75 requires dbo.booking_exception_reports. Run migration V73 first.', 1;
GO

IF COL_LENGTH('dbo.booking_exception_reports', 'admin_note') IS NULL
BEGIN
    ALTER TABLE dbo.booking_exception_reports
        ADD admin_note NVARCHAR(MAX) NULL;
END
GO

-- Widen the status CHECK constraint to also allow REJECTED.
DECLARE @statusConstraint NVARCHAR(200);

SELECT @statusConstraint = cc.name
FROM sys.check_constraints cc
WHERE cc.parent_object_id = OBJECT_ID('dbo.booking_exception_reports')
  AND cc.name LIKE 'CK_booking_exception_reports_status%';

IF @statusConstraint IS NOT NULL
BEGIN
    EXEC('ALTER TABLE dbo.booking_exception_reports DROP CONSTRAINT [' + @statusConstraint + ']');
END
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID('dbo.booking_exception_reports')
      AND name = 'CK_booking_exception_reports_status'
)
BEGIN
    ALTER TABLE dbo.booking_exception_reports
        ADD CONSTRAINT CK_booking_exception_reports_status
        CHECK (status IN ('PENDING', 'REVIEWED', 'RESOLVED', 'REJECTED'));
END
GO
