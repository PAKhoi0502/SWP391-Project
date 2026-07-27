IF COL_LENGTH('dbo.booking_add_on_service_packages', 'unit_price') IS NULL
BEGIN
    ALTER TABLE dbo.booking_add_on_service_packages
        ADD unit_price DECIMAL(18, 2) NULL;
END;

IF COL_LENGTH('dbo.booking_add_on_service_packages', 'added_by_user_id') IS NULL
BEGIN
    ALTER TABLE dbo.booking_add_on_service_packages
        ADD added_by_user_id BIGINT NULL;
END;

UPDATE ba
SET unit_price = sp.base_price
FROM dbo.booking_add_on_service_packages ba
JOIN dbo.service_packages sp ON sp.id = ba.service_package_id
WHERE ba.unit_price IS NULL;

IF EXISTS (
    SELECT 1
    FROM dbo.booking_add_on_service_packages
    GROUP BY booking_id, service_package_id
    HAVING COUNT(*) > 1
)
BEGIN
    THROW 50077, 'Duplicate booking add-on rows must be resolved before migration v77', 1;
END;

IF NOT EXISTS (
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID('dbo.booking_add_on_service_packages')
      AND name = 'uq_booking_add_on_booking_package'
)
BEGIN
    CREATE UNIQUE INDEX uq_booking_add_on_booking_package
        ON dbo.booking_add_on_service_packages(booking_id, service_package_id);
END;
