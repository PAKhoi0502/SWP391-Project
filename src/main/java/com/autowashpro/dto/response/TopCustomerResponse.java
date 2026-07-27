package com.autowashpro.dto.response;

import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.util.List;

@Getter
@Builder
public class TopCustomerResponse {

    private Long customerId;

    private String fullName;

    private String email;

    private String phone;

    private String avatarUrl;

    private String currentTier;

    private Integer totalVisits;

    private Integer totalPoints;

    private BigDecimal totalSpent;

    private List<String> licensePlates;

}
