package com.autowashpro.dto.response;

import lombok.*;

import java.time.LocalDateTime;
import java.util.List;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AvailablePackagesForTimeResponse {

    private Long garageId;

    private Long vehicleId;

    private LocalDateTime startTime;

    private List<AvailablePackageAtTimeResponse> packages;
}
