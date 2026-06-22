package com.autowashpro.dto.response;

import lombok.*;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ServicePackageInstructionResponse {

    private Long id;

    private Integer instructionOrder;

    private String content;
}