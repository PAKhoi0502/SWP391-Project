SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;
GO

IF OBJECT_ID('dbo.audit_logs', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.audit_logs (
        id BIGINT IDENTITY(1,1) NOT NULL,
        actor_id BIGINT NULL,
        action NVARCHAR(100) NOT NULL,
        target_type NVARCHAR(100) NOT NULL,
        target_id BIGINT NOT NULL,
        metadata NVARCHAR(MAX) NULL,
        created_at DATETIME2(0) NOT NULL CONSTRAINT DF_audit_logs_created_at DEFAULT SYSDATETIME(),
        CONSTRAINT PK_audit_logs PRIMARY KEY CLUSTERED (id),
        CONSTRAINT FK_audit_logs_actor FOREIGN KEY (actor_id) REFERENCES dbo.users(id)
    );
END;
GO

IF COL_LENGTH('dbo.audit_logs', 'target_type') IS NULL
   AND COL_LENGTH('dbo.audit_logs', 'entity_type') IS NOT NULL
BEGIN
    EXEC sp_rename 'dbo.audit_logs.entity_type', 'target_type', 'COLUMN';
END;
GO

IF COL_LENGTH('dbo.audit_logs', 'target_id') IS NULL
   AND COL_LENGTH('dbo.audit_logs', 'entity_id') IS NOT NULL
BEGIN
    EXEC sp_rename 'dbo.audit_logs.entity_id', 'target_id', 'COLUMN';
END;
GO

IF COL_LENGTH('dbo.audit_logs', 'metadata') IS NULL
BEGIN
    ALTER TABLE dbo.audit_logs ADD metadata NVARCHAR(MAX) NULL;
END;
GO

IF COL_LENGTH('dbo.audit_logs', 'old_value') IS NOT NULL
   AND COL_LENGTH('dbo.audit_logs', 'new_value') IS NOT NULL
   AND COL_LENGTH('dbo.audit_logs', 'ip_address') IS NOT NULL
   AND COL_LENGTH('dbo.audit_logs', 'user_agent') IS NOT NULL
BEGIN
    EXEC(N'
        UPDATE dbo.audit_logs
        SET metadata = (
            SELECT old_value, new_value, ip_address, user_agent
            FOR JSON PATH, WITHOUT_ARRAY_WRAPPER
        )
        WHERE metadata IS NULL
          AND (old_value IS NOT NULL OR new_value IS NOT NULL OR ip_address IS NOT NULL OR user_agent IS NOT NULL);
    ');
END;
GO

IF COL_LENGTH('dbo.audit_logs', 'old_value') IS NOT NULL
BEGIN
    ALTER TABLE dbo.audit_logs DROP COLUMN old_value;
END;
GO

IF COL_LENGTH('dbo.audit_logs', 'new_value') IS NOT NULL
BEGIN
    ALTER TABLE dbo.audit_logs DROP COLUMN new_value;
END;
GO

IF COL_LENGTH('dbo.audit_logs', 'ip_address') IS NOT NULL
BEGIN
    ALTER TABLE dbo.audit_logs DROP COLUMN ip_address;
END;
GO

IF COL_LENGTH('dbo.audit_logs', 'user_agent') IS NOT NULL
BEGIN
    ALTER TABLE dbo.audit_logs DROP COLUMN user_agent;
END;
GO

ALTER TABLE dbo.audit_logs ALTER COLUMN actor_id BIGINT NULL;
ALTER TABLE dbo.audit_logs ALTER COLUMN action NVARCHAR(100) NOT NULL;
ALTER TABLE dbo.audit_logs ALTER COLUMN target_type NVARCHAR(100) NOT NULL;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_audit_logs_created_at'
      AND object_id = OBJECT_ID('dbo.audit_logs')
)
BEGIN
    CREATE INDEX IX_audit_logs_created_at ON dbo.audit_logs(created_at DESC, id DESC);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_audit_logs_actor_id'
      AND object_id = OBJECT_ID('dbo.audit_logs')
)
BEGIN
    CREATE INDEX IX_audit_logs_actor_id ON dbo.audit_logs(actor_id, created_at DESC);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_audit_logs_action'
      AND object_id = OBJECT_ID('dbo.audit_logs')
)
BEGIN
    CREATE INDEX IX_audit_logs_action ON dbo.audit_logs(action, created_at DESC);
END;
GO

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_audit_logs_target'
      AND object_id = OBJECT_ID('dbo.audit_logs')
)
BEGIN
    CREATE INDEX IX_audit_logs_target ON dbo.audit_logs(target_type, target_id, created_at DESC);
END;
GO


SELECT * FROM users