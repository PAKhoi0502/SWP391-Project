package com.autowashpro.controller;

import com.autowashpro.common.ApiResponse;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1")
public class BaseController {

    @GetMapping
    public ApiResponse<String> welcome() {
        return ApiResponse.<String>builder()
                .success(true)
                .message("Welcome to AutoWash Pro API")
                .data("v1")
                .build();
    }
}