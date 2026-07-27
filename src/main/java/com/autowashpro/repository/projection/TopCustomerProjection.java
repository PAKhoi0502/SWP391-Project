package com.autowashpro.repository.projection;

import java.math.BigDecimal;

public interface TopCustomerProjection {
    Long getCustomerId();
    String getFullName();
    String getEmail();
    String getPhone();
    String getCurrentTier();
    Integer getTotalVisits();
    Integer getTotalPoints();
    BigDecimal getTotalSpent();
}
