-- used_count chỉ tăng sau khi booking COMPLETED + PAID
ALTER TABLE promotion_applicable_tiers
ADD CONSTRAINT UQ_pat
UNIQUE (promotion_id, tier);

ALTER TABLE promotions
ADD description NVARCHAR(500) NULL;

ALTER TABLE promotion_usages
ADD CONSTRAINT UQ_promotion_usage_booking
UNIQUE (booking_id);