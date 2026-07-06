package com.autowashpro.dto.request;

import com.fasterxml.jackson.annotation.JsonAlias;
import jakarta.validation.constraints.NotBlank;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class DeleteImageRequest {

    @NotBlank
    @JsonAlias("public_id")
    private String publicId;
}
