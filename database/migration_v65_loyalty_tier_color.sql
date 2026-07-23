-- =====================================================
-- Loyalty Tier Rules: custom color per rank
-- =====================================================

ALTER TABLE loyalty_tier_rules
ADD color VARCHAR(9) NOT NULL
CONSTRAINT DF_loyalty_tier_rules_color DEFAULT '#2563EB';
GO

-- Match the colors already shown on the customer-facing Member Tier modal
-- (frontend/src/components/common/TierGem.jsx TIER_COLORS + hash fallback for DIAMOND).
UPDATE loyalty_tier_rules
SET color = CASE tier
    WHEN 'BRONZE'   THEN '#CD7F32'
    WHEN 'SILVER'   THEN '#94A3B8'
    WHEN 'GOLD'     THEN '#F59E0B'
    WHEN 'PLATINUM' THEN '#9333EA'
    WHEN 'DIAMOND'  THEN '#F472B6'
    ELSE color
END;
