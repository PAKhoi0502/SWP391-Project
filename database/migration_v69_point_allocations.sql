-- v69: point_transaction_allocations — links REDEEM/EXPIRE debit transactions
--      to the EARN/REFUND credit lots they consumed (FIFO tracking).
IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'point_transaction_allocations')
BEGIN
    CREATE TABLE point_transaction_allocations (
        id                    BIGINT IDENTITY(1,1) PRIMARY KEY,
        debit_transaction_id  BIGINT NOT NULL,
        credit_transaction_id BIGINT NOT NULL,
        allocated_points      INT    NOT NULL,
        created_at            DATETIME2(6) NOT NULL DEFAULT SYSDATETIME(),

        CONSTRAINT FK_pta_debit  FOREIGN KEY (debit_transaction_id)
            REFERENCES point_transactions(id),
        CONSTRAINT FK_pta_credit FOREIGN KEY (credit_transaction_id)
            REFERENCES point_transactions(id),
        CONSTRAINT UQ_pta_debit_credit
            UNIQUE (debit_transaction_id, credit_transaction_id)
    );

    CREATE INDEX IX_pta_debit  ON point_transaction_allocations (debit_transaction_id);
    CREATE INDEX IX_pta_credit ON point_transaction_allocations (credit_transaction_id);
END
