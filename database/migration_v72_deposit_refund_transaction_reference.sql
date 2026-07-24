/* =========================================================
   Migration V72 - Persist deposit refund transfer reference

   Safe to run repeatedly on SQL Server.
========================================================= */

SET XACT_ABORT ON;
GO

IF OBJECT_ID('dbo.deposit_refunds', 'U') IS NULL
    THROW 51072, 'Migration V72 requires dbo.deposit_refunds. Run the deposit refund migration first.', 1;
GO

IF COL_LENGTH('dbo.deposit_refunds', 'transaction_reference') IS NULL
BEGIN
    ALTER TABLE dbo.deposit_refunds
    ADD transaction_reference NVARCHAR(100) NULL;
END;
GO

SELECT
    COL_LENGTH('dbo.deposit_refunds', 'transaction_reference') AS transaction_reference_length;
GO
