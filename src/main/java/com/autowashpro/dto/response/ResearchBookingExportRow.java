package com.autowashpro.dto.response;

import com.fasterxml.jackson.annotation.JsonProperty;
import com.fasterxml.jackson.annotation.JsonPropertyOrder;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.math.BigDecimal;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonPropertyOrder({
        "booking_anonymous_id", "customer_anonymous_id", "customer_type", "vehicle_type",
        "engine_type", "garage_area", "service_type", "booking_month", "day_of_week",
        "time_bucket", "scheduled_duration_minutes", "booking_status", "payment_status",
        "payment_method", "final_price", "discount_amount", "used_points", "loyalty_tier",
        "is_walk_in", "promotion_used", "wash_bay_used"
})
public class ResearchBookingExportRow {
    @JsonProperty("booking_anonymous_id")
    private String bookingAnonymousId;
    @JsonProperty("customer_anonymous_id")
    private String customerAnonymousId;
    @JsonProperty("customer_type")
    private String customerType;
    @JsonProperty("vehicle_type")
    private String vehicleType;
    @JsonProperty("engine_type")
    private String engineType;
    @JsonProperty("garage_area")
    private String garageArea;
    @JsonProperty("service_type")
    private String serviceType;
    @JsonProperty("booking_month")
    private String bookingMonth;
    @JsonProperty("day_of_week")
    private String dayOfWeek;
    @JsonProperty("time_bucket")
    private String timeBucket;
    @JsonProperty("scheduled_duration_minutes")
    private Long scheduledDurationMinutes;
    @JsonProperty("booking_status")
    private String bookingStatus;
    @JsonProperty("payment_status")
    private String paymentStatus;
    @JsonProperty("payment_method")
    private String paymentMethod;
    @JsonProperty("final_price")
    private BigDecimal finalPrice;
    @JsonProperty("discount_amount")
    private BigDecimal discountAmount;
    @JsonProperty("used_points")
    private Integer usedPoints;
    @JsonProperty("loyalty_tier")
    private String loyaltyTier;
    @JsonProperty("is_walk_in")
    private Boolean isWalkIn;
    @JsonProperty("promotion_used")
    private Boolean promotionUsed;
    @JsonProperty("wash_bay_used")
    private Boolean washBayUsed;
}
