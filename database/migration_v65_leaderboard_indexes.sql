-- Add index to optimize leaderboard query on point_transactions
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_point_transactions_leaderboard'
      AND object_id = OBJECT_ID('point_transactions')
)
BEGIN
    CREATE INDEX IX_point_transactions_leaderboard
    ON point_transactions (type, source, customer_id, created_at)
    INCLUDE (points);
END
