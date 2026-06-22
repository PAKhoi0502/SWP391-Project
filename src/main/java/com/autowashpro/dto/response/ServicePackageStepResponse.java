package com.autowashpro.dto.response;

import lombok.*;

import java.util.List;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ServicePackageStepResponse {

    private Long id;

    private Integer stepOrder;

    private String name;

    private String description;

    private Boolean isRequired;

    private List<ServicePackageInstructionResponse> instructions;
}