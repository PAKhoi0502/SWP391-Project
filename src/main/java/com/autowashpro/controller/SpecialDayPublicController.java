package com.autowashpro.controller;

import com.autowashpro.common.ApiResponse;
import com.autowashpro.dto.response.SpecialDayCheckResponse;
import com.autowashpro.service.SpecialDayService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.time.LocalDate;

// Public — booking flows (including anonymous guest booking) need to preview the
// holiday surcharge for a chosen date before the booking is actually created.
@RestController
@RequestMapping("/special-days")
@RequiredArgsConstructor
public class SpecialDayPublicController {

    private final SpecialDayService specialDayService;

    @GetMapping("/check")
    public ApiResponse<SpecialDayCheckResponse> check(
            @RequestParam("date") @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate date) {
        SpecialDayCheckResponse data = SpecialDayCheckResponse.builder()
                .isSpecialDay(specialDayService.isSpecialDay(date))
                .surchargeRate(specialDayService.getSurchargeRateForDate(date))
                .build();
        return ApiResponse.<SpecialDayCheckResponse>builder()
                .success(true)
                .message("Special day checked successfully")
                .data(data)
                .build();
    }
}
