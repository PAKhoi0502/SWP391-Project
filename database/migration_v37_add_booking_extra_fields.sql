-- Issue #11: Add note and used_points to bookings
ALTER TABLE bookings ADD note NVARCHAR(500) NULL;
ALTER TABLE bookings ADD used_points INT NOT NULL DEFAULT 0;