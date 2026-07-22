package com.autowashpro.dto.response;

import lombok.Builder;
import lombok.Data;

import java.time.LocalDate;

@Data
@Builder
public class StaffCalendarDayResponse {
    private LocalDate date;
    private long confirmed;
    private long cancelled;
}
