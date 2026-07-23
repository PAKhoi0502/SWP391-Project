SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;
GO

-- Backfill migration: bank_accounts previously existed in the live DB (referenced by
-- migration_v63_deposit_refunds.sql's FK) but was never created by a tracked script.
-- Filename must sort before migration_v63_deposit_refunds.sql so the FK target exists
-- when migrations are applied in order on a fresh database.
IF OBJECT_ID('dbo.bank_accounts', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.bank_accounts (
        id BIGINT IDENTITY(1,1) NOT NULL,
        customer_id BIGINT NOT NULL,
        bank_code NVARCHAR(20) NOT NULL,
        bank_name NVARCHAR(150) NOT NULL,
        account_number NVARCHAR(50) NOT NULL,
        account_holder_name NVARCHAR(150) NOT NULL,
        is_default BIT NOT NULL CONSTRAINT DF_bank_accounts_is_default DEFAULT 0,
        is_active BIT NOT NULL CONSTRAINT DF_bank_accounts_is_active DEFAULT 1,
        created_at DATETIME2(0) NOT NULL CONSTRAINT DF_bank_accounts_created_at DEFAULT SYSDATETIME(),
        updated_at DATETIME2(0) NOT NULL CONSTRAINT DF_bank_accounts_updated_at DEFAULT SYSDATETIME(),
        CONSTRAINT PK_bank_accounts PRIMARY KEY CLUSTERED (id),
        CONSTRAINT FK_bank_accounts_customer FOREIGN KEY (customer_id) REFERENCES dbo.users(id)
    );
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_bank_accounts_customer_id' AND object_id = OBJECT_ID('dbo.bank_accounts')
)
BEGIN
    CREATE INDEX IX_bank_accounts_customer_id ON dbo.bank_accounts(customer_id);
END;
GO
