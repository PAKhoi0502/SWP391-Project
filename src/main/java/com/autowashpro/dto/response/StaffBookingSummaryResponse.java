package com.autowashpro.dto.response;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class StaffBookingSummaryResponse {
    private long total;
    private long confirmed;
    private long inProgress;
    private long canceledAndNoShow;
}
