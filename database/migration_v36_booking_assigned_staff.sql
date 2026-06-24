CREATE TABLE booking_assigned_staff (
    id BIGINT IDENTITY(1,1) NOT NULL PRIMARY KEY,

    booking_id BIGINT NOT NULL,
    staff_profile_id BIGINT NOT NULL,
    assigned_from DATETIME2(0) NOT NULL,
    assigned_to DATETIME2(0) NOT NULL,
    role_in_booking NVARCHAR(30) NULL,

    status NVARCHAR(30) NOT NULL DEFAULT 'ASSIGNED',

    created_at DATETIME2(0) NOT NULL DEFAULT SYSDATETIME(),
    updated_at DATETIME2(0) NOT NULL DEFAULT SYSDATETIME(),

    CONSTRAINT FK_bas_booking
        FOREIGN KEY (booking_id)
        REFERENCES bookings(id),

    CONSTRAINT FK_bas_staff_profile
        FOREIGN KEY (staff_profile_id)
        REFERENCES staff_profiles(id),

    CONSTRAINT UQ_booking_staff
        UNIQUE (booking_id, staff_profile_id),

    CONSTRAINT CK_bas_time
        CHECK (assigned_from < assigned_to)
);

CREATE INDEX IX_bas_staff_time
ON booking_assigned_staff (
    staff_profile_id,
    assigned_from,
    assigned_to
);

CREATE INDEX IX_bas_booking
ON booking_assigned_staff (
    booking_id
);

CREATE INDEX IX_bas_status
ON booking_assigned_staff (
    status
);