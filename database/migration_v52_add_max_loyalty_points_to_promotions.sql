IF NOT EXISTS (
    SELECT 1
    FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.promotions')
      AND name = 'max_loyalty_points'
)
BEGIN
    ALTER TABLE dbo.promotions
        ADD max_loyalty_points INT NULL;
END;
