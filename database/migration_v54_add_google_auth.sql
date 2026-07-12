SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;
GO

-- Google-only accounts have no phone/password at sign-up time, so both
-- columns must become nullable. The plain UNIQUE constraint on phone only
-- allows a single NULL row in SQL Server, so it's replaced with a filtered
-- unique index that ignores NULLs.
DECLARE @phoneConstraint NVARCHAR(200);
SELECT @phoneConstraint = kc.name
FROM sys.key_constraints kc
JOIN sys.index_columns ic ON ic.object_id = kc.parent_object_id AND ic.index_id = kc.unique_index_id
JOIN sys.columns c ON c.object_id = ic.object_id AND c.column_id = ic.column_id
WHERE kc.parent_object_id = OBJECT_ID('dbo.users') AND c.name = 'phone' AND kc.type = 'UQ';

IF @phoneConstraint IS NOT NULL
BEGIN
    EXEC('ALTER TABLE dbo.users DROP CONSTRAINT [' + @phoneConstraint + ']');
END;
GO

IF COL_LENGTH('dbo.users', 'phone') IS NOT NULL
BEGIN
    ALTER TABLE dbo.users ALTER COLUMN phone NVARCHAR(20) NULL;
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_users_phone_filtered' AND object_id = OBJECT_ID('dbo.users'))
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX UQ_users_phone_filtered ON dbo.users(phone) WHERE phone IS NOT NULL;
END;
GO

IF COL_LENGTH('dbo.users', 'password_hash') IS NOT NULL
BEGIN
    ALTER TABLE dbo.users ALTER COLUMN password_hash NVARCHAR(255) NULL;
END;
GO

IF COL_LENGTH('dbo.users', 'google_id') IS NULL
BEGIN
    ALTER TABLE dbo.users ADD google_id NVARCHAR(255) NULL;
END;
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UQ_users_google_id' AND object_id = OBJECT_ID('dbo.users'))
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX UQ_users_google_id ON dbo.users(google_id) WHERE google_id IS NOT NULL;
END;
GO

IF COL_LENGTH('dbo.users', 'auth_provider') IS NULL
BEGIN
    ALTER TABLE dbo.users ADD auth_provider NVARCHAR(20) NOT NULL CONSTRAINT DF_users_auth_provider DEFAULT 'LOCAL';
END;
GO
