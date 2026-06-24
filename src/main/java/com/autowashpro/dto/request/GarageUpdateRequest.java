package com.autowashpro.dto.request;

import lombok.Data;

import java.time.LocalTime;

@Data
public class GarageUpdateRequest {
    // PATCH — field nào null thì giữ nguyên giá trị cũ
    private String name;
    private String address;
    private String city;
    private String phone;
    private LocalTime openingTime;
    private LocalTime closingTime;
    private Integer slotIntervalMinutes;
}