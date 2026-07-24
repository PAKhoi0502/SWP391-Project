/* =========================================================
   Migration V73 - Booking exception reports (customer-reported issues)

   Safe to run repeatedly on SQL Server.
========================================================= */

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'booking_exception_reports')
BEGIN
    CREATE TABLE [dbo].[booking_exception_reports] (
        [id]          [bigint]        IDENTITY(1,1) NOT NULL,
        [booking_id]  [bigint]        NOT NULL,
        [customer_id] [bigint]        NOT NULL,
        [category]    [nvarchar](30)  NOT NULL
            CONSTRAINT CK_booking_exception_reports_category
            CHECK (category IN ('VEHICLE_CONDITION', 'SERVICE_QUALITY', 'BILLING', 'OTHER')),
        [description] [nvarchar](max) NOT NULL,
        [status]      [nvarchar](20)  NOT NULL
            CONSTRAINT DF_booking_exception_reports_status DEFAULT 'PENDING'
            CONSTRAINT CK_booking_exception_reports_status
            CHECK (status IN ('PENDING', 'REVIEWED', 'RESOLVED')),
        [created_at]  [datetime2](0)  NOT NULL CONSTRAINT DF_booking_exception_reports_created_at DEFAULT GETDATE(),
        [updated_at]  [datetime2](0)  NOT NULL CONSTRAINT DF_booking_exception_reports_updated_at DEFAULT GETDATE(),
        CONSTRAINT PK_booking_exception_reports PRIMARY KEY CLUSTERED ([id] ASC),
        CONSTRAINT FK_booking_exception_reports_bookings FOREIGN KEY ([booking_id]) REFERENCES [dbo].[bookings]([id])
    );

    CREATE INDEX IX_booking_exception_reports_booking_id ON [dbo].[booking_exception_reports] ([booking_id]);
    CREATE INDEX IX_booking_exception_reports_customer_id ON [dbo].[booking_exception_reports] ([customer_id]);
    CREATE INDEX IX_booking_exception_reports_status ON [dbo].[booking_exception_reports] ([status]);
END
GO

-- booking_exception_report_images: photo attachments describing the issue (up to 5 per report)

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'booking_exception_report_images')
BEGIN
    CREATE TABLE [dbo].[booking_exception_report_images] (
        [id]            [bigint]         IDENTITY(1,1) NOT NULL,
        [report_id]     [bigint]         NOT NULL,
        [image_url]     [nvarchar](1024) NOT NULL,
        [display_order] [int]            NOT NULL CONSTRAINT DF_booking_exception_report_images_order DEFAULT 0,
        [created_at]    [datetime2](0)   NOT NULL CONSTRAINT DF_booking_exception_report_images_created_at DEFAULT GETDATE(),
        CONSTRAINT PK_booking_exception_report_images PRIMARY KEY CLUSTERED ([id] ASC),
        CONSTRAINT FK_booking_exception_report_images_report FOREIGN KEY ([report_id])
            REFERENCES [dbo].[booking_exception_reports]([id]) ON DELETE CASCADE
    );
END
GO
