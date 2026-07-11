IF OBJECT_ID('dbo.booking_add_on_service_packages', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.booking_add_on_service_packages (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        booking_id BIGINT NOT NULL,
        service_package_id BIGINT NOT NULL,
        sort_order INT NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT fk_booking_add_on_booking FOREIGN KEY (booking_id) REFERENCES dbo.bookings(id),
        CONSTRAINT fk_booking_add_on_service_package FOREIGN KEY (service_package_id) REFERENCES dbo.service_packages(id)
    );

    CREATE INDEX ix_booking_add_on_booking_id ON dbo.booking_add_on_service_packages(booking_id);
END;

select * from dbo.booking_add_on_service_packages

SELECT spi.id, spi.parent_service_package_id, spi.included_service_package_id,
       sp.name AS included_name, sp.service_type
FROM service_package_includes spi
JOIN service_packages sp ON sp.id = spi.included_service_package_id
WHERE spi.parent_service_package_id = (
    SELECT id FROM service_packages WHERE name LIKE N'%r?a xe%xóa xý?c%'
)