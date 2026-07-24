/* =========================================================
   Migration V63 - Bank accounts and deposit refund workflow

   Safe to run repeatedly on SQL Server.
   This migration intentionally contains no unrelated repair
   or diagnostic queries from later booking/care migrations.
========================================================= */

SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;
SET XACT_ABORT ON;
GO

/* ---------- Required parent tables ---------- */
IF OBJECT_ID('dbo.users', 'U') IS NULL
    THROW 51063, 'Migration V63 requires dbo.users. Run the base schema first.', 1;

IF OBJECT_ID('dbo.bookings', 'U') IS NULL
    THROW 51064, 'Migration V63 requires dbo.bookings. Run the base schema first.', 1;
GO

/* ---------- Saved customer bank accounts ----------
   The application already maps the BankAccount entity, but older
   database dumps did not include a migration that created this table.
*/
IF OBJECT_ID('dbo.bank_accounts', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.bank_accounts (
        id BIGINT IDENTITY(1,1) NOT NULL,
        customer_id BIGINT NOT NULL,
        bank_code NVARCHAR(20) NOT NULL,
        bank_name NVARCHAR(150) NOT NULL,
        account_number NVARCHAR(50) NOT NULL,
        account_holder_name NVARCHAR(150) NOT NULL,
        is_default BIT NOT NULL CONSTRAINT DF_bank_accounts_is_default DEFAULT (0),
        is_active BIT NOT NULL CONSTRAINT DF_bank_accounts_is_active DEFAULT (1),
        created_at DATETIME2(0) NOT NULL CONSTRAINT DF_bank_accounts_created_at DEFAULT SYSDATETIME(),
        updated_at DATETIME2(0) NOT NULL CONSTRAINT DF_bank_accounts_updated_at DEFAULT SYSDATETIME(),
        CONSTRAINT PK_bank_accounts PRIMARY KEY CLUSTERED (id),
        CONSTRAINT FK_bank_accounts_customer FOREIGN KEY (customer_id) REFERENCES dbo.users(id)
    );
END;
GO

-- Fail with a useful message instead of allowing Hibernate to fail later
-- when an older, incomplete bank_accounts table already exists.
IF COL_LENGTH('dbo.bank_accounts', 'customer_id') IS NULL
   OR COL_LENGTH('dbo.bank_accounts', 'bank_code') IS NULL
   OR COL_LENGTH('dbo.bank_accounts', 'bank_name') IS NULL
   OR COL_LENGTH('dbo.bank_accounts', 'account_number') IS NULL
   OR COL_LENGTH('dbo.bank_accounts', 'account_holder_name') IS NULL
   OR COL_LENGTH('dbo.bank_accounts', 'is_default') IS NULL
   OR COL_LENGTH('dbo.bank_accounts', 'is_active') IS NULL
   OR COL_LENGTH('dbo.bank_accounts', 'created_at') IS NULL
   OR COL_LENGTH('dbo.bank_accounts', 'updated_at') IS NULL
BEGIN
    THROW 51065, 'dbo.bank_accounts exists but does not match the BankAccount entity. Repair that table before running V63.', 1;
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.bank_accounts')
      AND name = 'IX_bank_accounts_customer_active'
)
BEGIN
    CREATE INDEX IX_bank_accounts_customer_active
        ON dbo.bank_accounts(customer_id, is_active);
END;
GO

/* ---------- Deposit refund requests ---------- */
IF OBJECT_ID('dbo.deposit_refunds', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.deposit_refunds (
        id BIGINT IDENTITY(1,1) NOT NULL,
        booking_id BIGINT NOT NULL,
        customer_id BIGINT NOT NULL,
        bank_account_id BIGINT NOT NULL,

        -- Snapshot the destination account so later profile edits do not
        -- change an already-reviewed refund request.
        bank_name NVARCHAR(150) NOT NULL,
        account_number NVARCHAR(50) NOT NULL,
        account_holder_name NVARCHAR(150) NOT NULL,

        requested_amount DECIMAL(18,2) NOT NULL,
        status NVARCHAR(20) NOT NULL CONSTRAINT DF_deposit_refunds_status DEFAULT ('REQUESTED'),
        reject_reason NVARCHAR(500) NULL,
        admin_note NVARCHAR(500) NULL,
        requested_at DATETIME2(0) NOT NULL CONSTRAINT DF_deposit_refunds_requested_at DEFAULT SYSDATETIME(),
        reviewed_by BIGINT NULL,
        reviewed_at DATETIME2(0) NULL,
        executed_by BIGINT NULL,
        executed_at DATETIME2(0) NULL,
        created_at DATETIME2(0) NOT NULL CONSTRAINT DF_deposit_refunds_created_at DEFAULT SYSDATETIME(),
        updated_at DATETIME2(0) NOT NULL CONSTRAINT DF_deposit_refunds_updated_at DEFAULT SYSDATETIME(),

        CONSTRAINT PK_deposit_refunds PRIMARY KEY CLUSTERED (id),
        CONSTRAINT FK_deposit_refunds_booking FOREIGN KEY (booking_id) REFERENCES dbo.bookings(id),
        CONSTRAINT FK_deposit_refunds_customer FOREIGN KEY (customer_id) REFERENCES dbo.users(id),
        CONSTRAINT FK_deposit_refunds_bank_account FOREIGN KEY (bank_account_id) REFERENCES dbo.bank_accounts(id),
        CONSTRAINT CK_deposit_refunds_amount_positive CHECK (requested_amount > 0),
        CONSTRAINT CK_deposit_refunds_status CHECK (
            status IN ('REQUESTED', 'APPROVED', 'REJECTED', 'PROCESSING', 'REFUNDED', 'FAILED', 'CANCELED')
        )
    );
END;
GO

IF COL_LENGTH('dbo.deposit_refunds', 'booking_id') IS NULL
   OR COL_LENGTH('dbo.deposit_refunds', 'customer_id') IS NULL
   OR COL_LENGTH('dbo.deposit_refunds', 'bank_account_id') IS NULL
   OR COL_LENGTH('dbo.deposit_refunds', 'bank_name') IS NULL
   OR COL_LENGTH('dbo.deposit_refunds', 'account_number') IS NULL
   OR COL_LENGTH('dbo.deposit_refunds', 'account_holder_name') IS NULL
   OR COL_LENGTH('dbo.deposit_refunds', 'requested_amount') IS NULL
   OR COL_LENGTH('dbo.deposit_refunds', 'status') IS NULL
   OR COL_LENGTH('dbo.deposit_refunds', 'requested_at') IS NULL
   OR COL_LENGTH('dbo.deposit_refunds', 'created_at') IS NULL
   OR COL_LENGTH('dbo.deposit_refunds', 'updated_at') IS NULL
BEGIN
    THROW 51066, 'dbo.deposit_refunds exists but is incomplete. Repair the table before running V63 again.', 1;
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.deposit_refunds')
      AND name = 'IX_deposit_refunds_booking_id'
)
BEGIN
    CREATE INDEX IX_deposit_refunds_booking_id
        ON dbo.deposit_refunds(booking_id);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.deposit_refunds')
      AND name = 'IX_deposit_refunds_customer_requested_at'
)
BEGIN
    CREATE INDEX IX_deposit_refunds_customer_requested_at
        ON dbo.deposit_refunds(customer_id, requested_at DESC);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.deposit_refunds')
      AND name = 'IX_deposit_refunds_status_requested_at'
)
BEGIN
    CREATE INDEX IX_deposit_refunds_status_requested_at
        ON dbo.deposit_refunds(status, requested_at DESC);
END;
GO

/* ---------- Verification (read-only) ---------- */
SELECT
    OBJECT_ID('dbo.bank_accounts', 'U') AS bank_accounts_object_id,
    OBJECT_ID('dbo.deposit_refunds', 'U') AS deposit_refunds_object_id;

SELECT
    name AS index_name
FROM sys.indexes
WHERE object_id = OBJECT_ID('dbo.deposit_refunds')
  AND name IS NOT NULL
ORDER BY name;
GO
