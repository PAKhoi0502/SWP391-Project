IF OBJECT_ID('dbo.waitlist_add_on_service_packages', 'U') IS NULL
BEGIN
    CREATE TABLE dbo.waitlist_add_on_service_packages (
        id BIGINT IDENTITY(1,1) PRIMARY KEY,
        waitlist_id BIGINT NOT NULL,
        service_package_id BIGINT NOT NULL,
        created_at DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME(),
        CONSTRAINT fk_waitlist_add_on_waitlist FOREIGN KEY (waitlist_id) REFERENCES dbo.waitlists(id),
        CONSTRAINT fk_waitlist_add_on_service_package FOREIGN KEY (service_package_id) REFERENCES dbo.service_packages(id)
    );

    CREATE INDEX ix_waitlist_add_on_waitlist_id ON dbo.waitlist_add_on_service_packages(waitlist_id);
END;
GO
