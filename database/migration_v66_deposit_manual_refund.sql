/* =========================================================
   Migration V54
   Deposit & Manual Refund + Guest Tracking
========================================================= */

------------------------------------------------------------
-- USERS
-- Bank information for manual refund
------------------------------------------------------------

IF NOT EXISTS (
    SELECT 1
    FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.users')
      AND name = 'bank_name'
)
BEGIN
    ALTER TABLE dbo.users
    ADD bank_name NVARCHAR(100) NULL;
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.users')
      AND name = 'bank_account_name'
)
BEGIN
    ALTER TABLE dbo.users
    ADD bank_account_name NVARCHAR(100) NULL;
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.users')
      AND name = 'bank_account_number'
)
BEGIN
    ALTER TABLE dbo.users
    ADD bank_account_number NVARCHAR(50) NULL;
END;
GO

------------------------------------------------------------
-- BOOKINGS
-- Guest tracking
------------------------------------------------------------

IF NOT EXISTS (
    SELECT 1
    FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.bookings')
      AND name = 'tracking_token'
)
BEGIN
    ALTER TABLE dbo.bookings
    ADD tracking_token NVARCHAR(255) NULL;
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.bookings')
      AND name = 'tracking_token_expired_at'
)
BEGIN
    ALTER TABLE dbo.bookings
    ADD tracking_token_expired_at DATETIME2 NULL;
END;
GO

------------------------------------------------------------
-- BOOKINGS
-- Guest refund information
------------------------------------------------------------

IF NOT EXISTS (
    SELECT 1
    FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.bookings')
      AND name = 'refund_bank_name'
)
BEGIN
    ALTER TABLE dbo.bookings
    ADD refund_bank_name NVARCHAR(100) NULL;
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.bookings')
      AND name = 'refund_bank_account_name'
)
BEGIN
    ALTER TABLE dbo.bookings
    ADD refund_bank_account_name NVARCHAR(100) NULL;
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.bookings')
      AND name = 'refund_bank_account_number'
)
BEGIN
    ALTER TABLE dbo.bookings
    ADD refund_bank_account_number NVARCHAR(50) NULL;
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.bookings')
      AND name = 'refund_requested_at'
)
BEGIN
    ALTER TABLE dbo.bookings
    ADD refund_requested_at DATETIME2 NULL;
END;
GO

------------------------------------------------------------
-- INDEXES
------------------------------------------------------------

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_users_bank_account_number'
      AND object_id = OBJECT_ID('dbo.users')
)
BEGIN
    CREATE INDEX IX_users_bank_account_number
    ON dbo.users(bank_account_number);
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_bookings_tracking_token'
      AND object_id = OBJECT_ID('dbo.bookings')
)
BEGIN
    CREATE UNIQUE INDEX IX_bookings_tracking_token
    ON dbo.bookings(tracking_token)
    WHERE tracking_token IS NOT NULL;
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'IX_bookings_refund_requested_at'
      AND object_id = OBJECT_ID('dbo.bookings')
)
BEGIN
    CREATE INDEX IX_bookings_refund_requested_at
    ON dbo.bookings(refund_requested_at);
END;
GO