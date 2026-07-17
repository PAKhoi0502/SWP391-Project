SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;
GO

-- Tracks exactly which transaction paid a booking's deposit, and when.
IF COL_LENGTH('dbo.bookings', 'deposit_paid_at') IS NULL
BEGIN
    ALTER TABLE dbo.bookings ADD deposit_paid_at DATETIME2(0) NULL;
END;
GO

IF COL_LENGTH('dbo.bookings', 'deposit_transaction_id') IS NULL
BEGIN
    ALTER TABLE dbo.bookings ADD deposit_transaction_id BIGINT NULL;
END;
GO
