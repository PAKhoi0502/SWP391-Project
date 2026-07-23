SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;
GO

IF OBJECT_ID('tempdb..#phone_normalization') IS NOT NULL
    DROP TABLE #phone_normalization;

SELECT
    id,
    phone,
    REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(LTRIM(RTRIM(phone)), ' ', ''), '.', ''), '-', ''), '(', ''), ')', '') AS compact,
    CAST(NULL AS NVARCHAR(20)) AS canonical
INTO #phone_normalization
FROM dbo.users
WHERE phone IS NOT NULL;

UPDATE #phone_normalization
SET canonical = CASE
    WHEN LEN(compact) = 10
         AND compact NOT LIKE '%[^0-9]%'
         AND LEFT(compact, 1) = '0'
         AND SUBSTRING(compact, 2, 1) IN ('3', '5', '7', '8', '9')
        THEN '+84' + SUBSTRING(compact, 2, 9)
    WHEN LEN(compact) = 12
         AND LEFT(compact, 3) = '+84'
         AND SUBSTRING(compact, 4, 9) NOT LIKE '%[^0-9]%'
         AND SUBSTRING(compact, 4, 1) IN ('3', '5', '7', '8', '9')
        THEN compact
END;

IF EXISTS (SELECT 1 FROM #phone_normalization WHERE canonical IS NULL)
BEGIN
    THROW 50001, 'Cannot normalize users.phone because invalid Vietnamese mobile numbers exist.', 1;
END;

IF EXISTS (
    SELECT canonical
    FROM #phone_normalization
    GROUP BY canonical
    HAVING COUNT(*) > 1
)
BEGIN
    THROW 50002, 'Cannot normalize users.phone because canonical phone collisions exist.', 1;
END;

UPDATE u
SET phone = n.canonical
FROM dbo.users u
JOIN #phone_normalization n ON n.id = u.id;

DROP TABLE #phone_normalization;
GO

IF EXISTS (
    SELECT 1
    FROM sys.check_constraints
    WHERE name = 'CK_users_phone_canonical'
      AND parent_object_id = OBJECT_ID('dbo.users')
)
BEGIN
    ALTER TABLE dbo.users DROP CONSTRAINT CK_users_phone_canonical;
END;
GO

ALTER TABLE dbo.users ADD CONSTRAINT CK_users_phone_canonical CHECK (
    phone IS NULL OR (
        DATALENGTH(phone) = 24
        AND LEFT(phone, 3) = '+84'
        AND SUBSTRING(phone, 4, 1) IN ('3', '5', '7', '8', '9')
        AND SUBSTRING(phone, 4, 9) NOT LIKE '%[^0-9]%'
    )
);
GO

UPDATE dbo.vehicles
SET vehicle_type = CASE
    WHEN UPPER(LTRIM(RTRIM(vehicle_type))) IN ('BIKE', 'MOTORBIKE', 'MOTORCYCLE', 'XE_MAY') THEN 'BIKE'
    WHEN UPPER(LTRIM(RTRIM(vehicle_type))) IN ('CAR', 'AUTO') THEN 'CAR'
    ELSE UPPER(LTRIM(RTRIM(vehicle_type)))
END;
GO

DECLARE @vehicleConstraint NVARCHAR(200);

WHILE 1 = 1
BEGIN
    SET @vehicleConstraint = NULL;

    SELECT TOP 1 @vehicleConstraint = kc.name
    FROM sys.key_constraints kc
    WHERE kc.parent_object_id = OBJECT_ID('dbo.vehicles')
      AND kc.type = 'UQ'
      AND 1 = (
          SELECT COUNT(*)
          FROM sys.index_columns ic
          WHERE ic.object_id = kc.parent_object_id
            AND ic.index_id = kc.unique_index_id
            AND ic.key_ordinal > 0
      )
      AND EXISTS (
          SELECT 1
          FROM sys.index_columns ic
          JOIN sys.columns c
            ON c.object_id = ic.object_id
           AND c.column_id = ic.column_id
          WHERE ic.object_id = kc.parent_object_id
            AND ic.index_id = kc.unique_index_id
            AND c.name = 'normalized_license_plate'
      );

    IF @vehicleConstraint IS NULL BREAK;
    EXEC('ALTER TABLE dbo.vehicles DROP CONSTRAINT [' + @vehicleConstraint + ']');
END;
GO

DECLARE @vehicleIndex NVARCHAR(200);

WHILE 1 = 1
BEGIN
    SET @vehicleIndex = NULL;

    SELECT TOP 1 @vehicleIndex = i.name
    FROM sys.indexes i
    WHERE i.object_id = OBJECT_ID('dbo.vehicles')
      AND i.is_unique = 1
      AND i.is_unique_constraint = 0
      AND i.name <> 'UQ_vehicles_normalized_plate_type'
      AND 1 = (
          SELECT COUNT(*)
          FROM sys.index_columns ic
          WHERE ic.object_id = i.object_id
            AND ic.index_id = i.index_id
            AND ic.key_ordinal > 0
      )
      AND EXISTS (
          SELECT 1
          FROM sys.index_columns ic
          JOIN sys.columns c
            ON c.object_id = ic.object_id
           AND c.column_id = ic.column_id
          WHERE ic.object_id = i.object_id
            AND ic.index_id = i.index_id
            AND c.name = 'normalized_license_plate'
      );

    IF @vehicleIndex IS NULL BREAK;
    EXEC('DROP INDEX [' + @vehicleIndex + '] ON dbo.vehicles');
END;
GO

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE name = 'UQ_vehicles_normalized_plate_type'
      AND object_id = OBJECT_ID('dbo.vehicles')
)
BEGIN
    CREATE UNIQUE NONCLUSTERED INDEX UQ_vehicles_normalized_plate_type
        ON dbo.vehicles(normalized_license_plate, vehicle_type);
END;
GO
