package com.autowashpro.controller;

import com.autowashpro.dto.request.TestRequest;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/test")
public class TestController {

    @PostMapping
    public String testValidation(
            @Valid @RequestBody TestRequest request) {

        return "Hello " + request.getName();
    }
}