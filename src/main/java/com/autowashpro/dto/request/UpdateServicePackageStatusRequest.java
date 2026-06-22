package com.autowashpro.dto.request;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class UpdateServicePackageStatusRequest {

    private Boolean isActive;
}