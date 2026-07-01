ALTER TABLE bookings
ADD promotion_discount_amount DECIMAL(18,2) NOT NULL
DEFAULT 0;