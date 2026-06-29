package com.autowashpro.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDateTime;

@Data
@Builder
public class PointTransactionResponse {
    private Long id;
    private Long customerId;
    private Long bookingId;
    private String type;
    private Integer points;
    private Integer remainingPoints;
    private LocalDateTime expiredAt;
    private String source;
    private String note;
    private LocalDateTime createdAt;
}