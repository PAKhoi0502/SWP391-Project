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
        "customer_anonymous_id", "customer_type", "loyalty_tier", "total_bookings",
        "completed_bookings", "canceled_bookings", "no_show_bookings", "paid_bookings",
        "total_spent", "average_spent", "promotion_usage_count", "points_redeemed",
        "primary_vehicle_type", "preferred_time_bucket", "active_months", "distinct_garage_areas"
})
public class ResearchCustomerExportRow {
    @JsonProperty("customer_anonymous_id")
    private String customerAnonymousId;
    @JsonProperty("customer_type")
    private String customerType;
    @JsonProperty("loyalty_tier")
    private String loyaltyTier;
    @JsonProperty("total_bookings")
    private Long totalBookings;
    @JsonProperty("completed_bookings")
    private Long completedBookings;
    @JsonProperty("canceled_bookings")
    private Long canceledBookings;
    @JsonProperty("no_show_bookings")
    private Long noShowBookings;
    @JsonProperty("paid_bookings")
    private Long paidBookings;
    @JsonProperty("total_spent")
    private BigDecimal totalSpent;
    @JsonProperty("average_spent")
    private BigDecimal averageSpent;
    @JsonProperty("promotion_usage_count")
    private Long promotionUsageCount;
    @JsonProperty("points_redeemed")
    private Integer pointsRedeemed;
    @JsonProperty("primary_vehicle_type")
    private String primaryVehicleType;
    @JsonProperty("preferred_time_bucket")
    private String preferredTimeBucket;
    @JsonProperty("active_months")
    private Integer activeMonths;
    @JsonProperty("distinct_garage_areas")
    private Integer distinctGarageAreas;
}
