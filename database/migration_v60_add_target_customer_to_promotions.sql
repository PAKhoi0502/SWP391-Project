IF NOT EXISTS (
    SELECT 1
    FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.promotions')
      AND name = 'target_customer_id'
)
BEGIN
    ALTER TABLE dbo.promotions
        ADD target_customer_id BIGINT NULL;
END;
