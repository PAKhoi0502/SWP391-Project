SET ANSI_NULLS ON;
SET ANSI_PADDING ON;
SET ANSI_WARNINGS ON;
SET ARITHABORT ON;
SET CONCAT_NULL_YIELDS_NULL ON;
SET QUOTED_IDENTIFIER ON;
SET NUMERIC_ROUNDABORT OFF;
GO

-- BRONZE now requires at least 1 completed+paid visit; new accounts start
-- unranked ("NEW") and only become BRONZE after their first wash.
UPDATE loyalty_tier_rules
SET min_total_visits = 1
WHERE tier = 'BRONZE' AND min_total_visits = 0;
GO

-- Existing customers who never completed a paid booking were auto-assigned
-- BRONZE on creation under the old logic — reset them to unranked so the
-- new "no rank until first use" rule applies retroactively.
UPDATE customer_loyalties
SET current_tier = 'NEW'
WHERE current_tier = 'BRONZE' AND total_visits = 0;
GO
