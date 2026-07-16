package com.autowashpro.dto.request;

import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class ManualRefundRequest {

    @Size(max = 500)
    private String note;

}