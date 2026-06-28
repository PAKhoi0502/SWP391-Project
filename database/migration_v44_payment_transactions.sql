-- =====================================================
-- Additional changes by Phan Hoang Thong
-- Issue #21 PayOS QR Payment Flow
-- =====================================================
CREATE TABLE payment_transactions (
    id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    booking_id BIGINT NOT NULL,
    payment_method NVARCHAR(30) NOT NULL DEFAULT 'PAYOS',
    amount DECIMAL(18,2) NOT NULL,
    status NVARCHAR(30) NOT NULL DEFAULT 'PENDING',
    order_code BIGINT NOT NULL UNIQUE,
    checkout_url NVARCHAR(500) NULL,
    qr_code NVARCHAR(500) NULL,
    payos_transaction_id NVARCHAR(255) NULL,
    cancel_reason NVARCHAR(255) NULL,
    paid_at DATETIME2(0) NULL,
    expired_at DATETIME2(0) NULL,
    created_at DATETIME2(0) NOT NULL DEFAULT SYSDATETIME(),
    updated_at DATETIME2(0) NOT NULL DEFAULT SYSDATETIME(),
    CONSTRAINT FK_payment_transactions_booking FOREIGN KEY (booking_id) REFERENCES bookings(id)
);