package com.autowashpro.dto.response;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class CareBoardResponse {
    private List<CareTaskResponse> upcoming;
    private List<CareTaskResponse> waitingForCare;
    private List<CareTaskResponse> inCare;
}
