package com.autowashpro.controller;

import com.autowashpro.common.ApiResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/health")
public class HealthController {

    @GetMapping
    public ApiResponse<String> health() {
        return ApiResponse.<String>builder()
                .success(true)
                .message("Server is running")
                .data("UP")
                .build();
    }
}