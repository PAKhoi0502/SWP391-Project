-- =====================================================
-- Loyalty Business Rules Update
-- Issue #22 Customer Loyalty
-- =====================================================

-- ==========================================
-- Customer Loyalty
-- ==========================================

ALTER TABLE customer_loyalties
ADD last_visit_at DATETIME2(0) NULL;

ALTER TABLE customer_loyalties
ADD last_point_expiry_check_at DATETIME2(0) NULL;

ALTER TABLE customer_loyalties
ADD last_tier_downgrade_at DATETIME2(0) NULL;

ALTER TABLE customer_loyalties
ADD tier_recovery_started_at DATETIME2(0) NULL;


-- ==========================================
-- Loyalty Tier Rules
-- ==========================================

ALTER TABLE loyalty_tier_rules
ADD priority_level INT NOT NULL
CONSTRAINT DF_loyalty_priority_level DEFAULT 1;

ALTER TABLE loyalty_tier_rules
ADD min_total_points INT NOT NULL
CONSTRAINT DF_loyalty_min_total_points DEFAULT 0;


-- ==========================================
-- Rename earn_rate -> point_multiplier
-- ==========================================

EXEC sp_rename
'loyalty_tier_rules.earn_rate',
'point_multiplier',
'COLUMN';

EXEC sp_rename
'customer_loyalties.last_review_at',
'last_tier_review_at',
'COLUMN';

-- ==========================================
-- Seed Loyalty Tier Rules
-- ==========================================

DELETE FROM loyalty_tier_rules;

INSERT INTO loyalty_tier_rules
(
    tier,
    min_total_spent,
    min_total_visits,
    min_total_points,
    booking_window_days,
    max_upcoming_bookings,
    point_multiplier,
    priority_level,
    is_active
)
VALUES
('BRONZE',   0,       0,   0,   7,  1, 1.00, 1, 1),
('SILVER',   1000000,  5, 100,  10, 1, 1.20, 2, 1),
('GOLD',     3000000,12, 300,  12, 2, 1.35, 3, 1),
('PLATINUM', 6000000,25, 700,  14, 3, 1.50, 4, 1);

UPDATE loyalty_tier_rules
SET min_total_visits = CASE tier
    WHEN 'BRONZE' THEN 0
    WHEN 'SILVER' THEN 10
    WHEN 'GOLD' THEN 20
    WHEN 'PLATINUM' THEN 35
    ELSE min_total_visits
END
WHERE tier IN ('BRONZE', 'SILVER', 'GOLD', 'PLATINUM');

SELECT * from loyalty_tier_rules

UPDATE loyalty_tier_rules
SET min_total_spent = CASE tier
    WHEN 'BRONZE' THEN 0
    WHEN 'SILVER' THEN 1000000
    WHEN 'GOLD' THEN 3000000
    WHEN 'PLATINUM' THEN 6000000
    ELSE min_total_spent
END
WHERE tier IN ('BRONZE', 'SILVER', 'GOLD', 'PLATINUM');



SELECT *
FROM loyalty_tier_rules;

SELECT * FROM booking_service_steps

select * from wash_bays
select * from service_packages
select * from garages

update garages
set slot_interval_minutes = 30
select * from vehicles

select * from users

ALTER TABLE bookings
ADD promotion_discount_amount DECIMAL(18,2) NOT NULL
DEFAULT 0;

select * from bookings
SELECT * FROM vehicles
SELECT * FROM vehicle_inspections

SELECT id, status, start_time, end_time FROM bookings
WHERE garage_id = <garage_id>
  AND start_time < '2026-07-05 08:00:00'
  AND end_time > '2026-07-05 07:30:00'
  AND status NOT IN ('CANCELED', 'NO_SHOW');
