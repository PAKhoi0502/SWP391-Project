SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;
GO

-- Issue #46: Customer Review / Rating system
-- booking_reviews: one review per booking, customer + rating + comment

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'booking_reviews')
BEGIN
    CREATE TABLE [dbo].[booking_reviews] (
        [id]          [bigint]       IDENTITY(1,1) NOT NULL,
        [booking_id]  [bigint]       NOT NULL,
        [customer_id] [bigint]       NOT NULL,
        [rating]      [tinyint]      NOT NULL CONSTRAINT CK_booking_reviews_rating CHECK (rating BETWEEN 1 AND 5),
        [comment]     [nvarchar](max) NULL,
        [created_at]  [datetime2](0) NOT NULL CONSTRAINT DF_booking_reviews_created_at DEFAULT GETDATE(),
        [updated_at]  [datetime2](0) NOT NULL CONSTRAINT DF_booking_reviews_updated_at DEFAULT GETDATE(),
        CONSTRAINT PK_booking_reviews PRIMARY KEY CLUSTERED ([id] ASC),
        CONSTRAINT UQ_booking_reviews_booking_id UNIQUE ([booking_id]),
        CONSTRAINT FK_booking_reviews_bookings FOREIGN KEY ([booking_id]) REFERENCES [dbo].[bookings]([id])
    );
END
GO

-- booking_review_images: optional photo attachments (up to 5 per review)

IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'booking_review_images')
BEGIN
    CREATE TABLE [dbo].[booking_review_images] (
        [id]            [bigint]        IDENTITY(1,1) NOT NULL,
        [review_id]     [bigint]        NOT NULL,
        [image_url]     [nvarchar](1024) NOT NULL,
        [display_order] [int]           NOT NULL CONSTRAINT DF_booking_review_images_order DEFAULT 0,
        [created_at]    [datetime2](0)  NOT NULL CONSTRAINT DF_booking_review_images_created_at DEFAULT GETDATE(),
        CONSTRAINT PK_booking_review_images PRIMARY KEY CLUSTERED ([id] ASC),
        CONSTRAINT FK_booking_review_images_review FOREIGN KEY ([review_id])
            REFERENCES [dbo].[booking_reviews]([id]) ON DELETE CASCADE
    );
END
GO

SELECT * FROM users