package com.autowashpro.dto.request;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDate;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AnalyticsFilterRequest {
    private LocalDate from;
    private LocalDate to;
    private Long garageId;
}
