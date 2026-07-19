SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;
GO

-- payment_transactions was defined in migration_v44 but never applied on some environments.
-- Re-create it idempotently here so deposit-purpose transactions have somewhere to live.
IF OBJECT_ID('dbo.payment_transactions', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.payment_transactions (
        id BIGINT IDENTITY(1,1) NOT NULL,
        booking_id BIGINT NOT NULL,
        payment_method NVARCHAR(30) NOT NULL CONSTRAINT DF_payment_transactions_method DEFAULT 'PAYOS',
        amount DECIMAL(18,2) NOT NULL,
        status NVARCHAR(30) NOT NULL CONSTRAINT DF_payment_transactions_status DEFAULT 'PENDING',
        order_code BIGINT NOT NULL,
        checkout_url NVARCHAR(500) NULL,
        qr_code NVARCHAR(500) NULL,
        payos_transaction_id NVARCHAR(255) NULL,
        cancel_reason NVARCHAR(255) NULL,
        paid_at DATETIME2(0) NULL,
        expired_at DATETIME2(0) NULL,
        created_at DATETIME2(0) NOT NULL CONSTRAINT DF_payment_transactions_created_at DEFAULT SYSDATETIME(),
        updated_at DATETIME2(0) NOT NULL CONSTRAINT DF_payment_transactions_updated_at DEFAULT SYSDATETIME(),
        CONSTRAINT PK_payment_transactions PRIMARY KEY CLUSTERED (id),
        CONSTRAINT UQ_payment_transactions_order_code UNIQUE (order_code),
        CONSTRAINT FK_payment_transactions_booking FOREIGN KEY (booking_id) REFERENCES dbo.bookings(id)
    );
END;
GO

-- Distinguishes a deposit payment link from the final-payment link so both can coexist per booking.
IF COL_LENGTH('dbo.payment_transactions', 'purpose') IS NULL
BEGIN
    ALTER TABLE dbo.payment_transactions
        ADD purpose NVARCHAR(20) NOT NULL CONSTRAINT DF_payment_transactions_purpose DEFAULT 'FINAL';
END;
GO
