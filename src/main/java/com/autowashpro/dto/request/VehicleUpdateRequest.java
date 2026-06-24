package com.autowashpro.dto.request;

import lombok.Data;

@Data
public class VehicleUpdateRequest {
    private String brand;
    private String model;
    private String color;
    private String engineType;
    private Integer seatCount;
    private String motorbikeGroup;
}