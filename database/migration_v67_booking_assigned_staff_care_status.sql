SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;
GO

-- Care Staff Dashboard (Upcoming / Waiting for Care / In Care lanes): tracks each
-- assigned care staff member's own progress on a booking, independent of the
-- booking-level wash-bay/completion lifecycle (which currently releases the wash
-- bay and completes the booking in one atomic step — see completeService()).
IF COL_LENGTH('dbo.booking_assigned_staff', 'care_status') IS NULL
BEGIN
    ALTER TABLE dbo.booking_assigned_staff
    ADD care_status NVARCHAR(20) NOT NULL CONSTRAINT DF_booking_assigned_staff_care_status DEFAULT 'ASSIGNED';
END;
GO

IF COL_LENGTH('dbo.booking_assigned_staff', 'care_started_at') IS NULL
BEGIN
    ALTER TABLE dbo.booking_assigned_staff
    ADD care_started_at DATETIME2(0) NULL;
END;
GO

IF COL_LENGTH('dbo.booking_assigned_staff', 'care_completed_at') IS NULL
BEGIN
    ALTER TABLE dbo.booking_assigned_staff
    ADD care_completed_at DATETIME2(0) NULL;
END;
GO
