IF NOT EXISTS (
    SELECT 1
    FROM sys.columns
    WHERE object_id = OBJECT_ID('dbo.promotions')
      AND name = 'allow_loyalty_stack'
)
BEGIN
    ALTER TABLE dbo.promotions
        ADD allow_loyalty_stack BIT NOT NULL DEFAULT 0;
END;
