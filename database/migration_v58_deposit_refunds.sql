SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;
GO

-- Deposit Refund workflow (issue #45/#162): explicit customer request against a
-- verified bank_accounts row, reviewed by admin via approve/reject/execute.
IF OBJECT_ID('dbo.deposit_refunds', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.deposit_refunds (
        id BIGINT IDENTITY(1,1) NOT NULL,
        booking_id BIGINT NOT NULL,
        customer_id BIGINT NOT NULL,
        bank_account_id BIGINT NOT NULL,
        bank_name NVARCHAR(150) NOT NULL,
        account_number NVARCHAR(50) NOT NULL,
        account_holder_name NVARCHAR(150) NOT NULL,
        requested_amount DECIMAL(18,2) NOT NULL,
        status NVARCHAR(20) NOT NULL CONSTRAINT DF_deposit_refunds_status DEFAULT 'REQUESTED',
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
        CONSTRAINT FK_deposit_refunds_bank_account FOREIGN KEY (bank_account_id) REFERENCES dbo.bank_accounts(id)
    );
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_deposit_refunds_booking_id' AND object_id = OBJECT_ID('dbo.deposit_refunds')
)
BEGIN
    CREATE INDEX IX_deposit_refunds_booking_id ON dbo.deposit_refunds(booking_id);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_deposit_refunds_customer_id' AND object_id = OBJECT_ID('dbo.deposit_refunds')
)
BEGIN
    CREATE INDEX IX_deposit_refunds_customer_id ON dbo.deposit_refunds(customer_id);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_deposit_refunds_status' AND object_id = OBJECT_ID('dbo.deposit_refunds')
)
BEGIN
    CREATE INDEX IX_deposit_refunds_status ON dbo.deposit_refunds(status);
END;
GO
