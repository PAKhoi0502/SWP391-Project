SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;
GO

IF EXISTS (SELECT 1 FROM sys.foreign_keys WHERE name = 'FK_bss_template_step')
BEGIN
    ALTER TABLE dbo.booking_service_steps DROP CONSTRAINT FK_bss_template_step;
END;
GO

IF COL_LENGTH('dbo.booking_service_steps', 'service_package_step_id') IS NOT NULL
BEGIN
    ALTER TABLE dbo.booking_service_steps ALTER COLUMN service_package_step_id BIGINT NULL;
END;
GO

ALTER TABLE dbo.booking_service_steps
    ADD CONSTRAINT FK_bss_template_step
    FOREIGN KEY (service_package_step_id)
    REFERENCES dbo.service_package_steps(id)
    ON DELETE SET NULL;
GO
