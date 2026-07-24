/* =========================================================
   Migration V76 - Service packages: open-ended seat count tiers

   Adds seat_count_and_above so a package like "7 seats and above"
   can be matched as a floor (vehicleSeatCount >= seatCount) instead
   of the default base-tier rule (vehicleSeatCount <= seatCount + 1).

   Safe to run repeatedly on SQL Server.
========================================================= */

IF COL_LENGTH('dbo.service_packages', 'seat_count_and_above') IS NULL
BEGIN
    ALTER TABLE dbo.service_packages
        ADD seat_count_and_above BIT NOT NULL CONSTRAINT DF_service_packages_seat_count_and_above DEFAULT (0);
END
GO

UPDATE dbo.service_packages
SET seat_count = 7,
    seat_count_and_above = 1
WHERE id = 3
  AND vehicle_type = 'CAR';
GO
