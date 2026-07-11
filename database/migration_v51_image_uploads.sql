SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'UX_uploads_public_id'
      AND object_id = OBJECT_ID('dbo.uploads')
)
BEGIN
    CREATE UNIQUE INDEX UX_uploads_public_id
        ON dbo.uploads(public_id)
        WHERE public_id IS NOT NULL;
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'UX_uploads_avatar_entity'
      AND object_id = OBJECT_ID('dbo.uploads')
)
BEGIN
    CREATE UNIQUE INDEX UX_uploads_avatar_entity
        ON dbo.uploads(entity_id)
        WHERE entity_type = N'AVATAR';
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'UX_vehicle_inspection_images_public_id'
      AND object_id = OBJECT_ID('dbo.vehicle_inspection_images')
)
BEGIN
    CREATE UNIQUE INDEX UX_vehicle_inspection_images_public_id
        ON dbo.vehicle_inspection_images(public_id)
        WHERE public_id IS NOT NULL;
END;
GO
