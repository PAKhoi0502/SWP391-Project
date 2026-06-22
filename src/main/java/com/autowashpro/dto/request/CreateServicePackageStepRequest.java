package com.autowashpro.dto.request;

import lombok.*;

import java.util.List;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class CreateServicePackageStepRequest {

    private Integer stepOrder;

    private String name;

    private String description;

    private Boolean isRequired;

    private List<String> instructions;
}