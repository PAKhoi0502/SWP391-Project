package com.autowashpro.dto.response;

import lombok.*;

import java.time.LocalDate;
import java.util.List;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AvailableSlotResponse {

    private Long garageId;

    private Long servicePackageId;

    private LocalDate date;

    private List<SlotResponse> slots;
}