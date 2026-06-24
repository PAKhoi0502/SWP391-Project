package com.autowashpro.service;

import com.autowashpro.dto.response.AvailableSlotResponse;

import java.time.LocalDate;

public interface BookingService {

    AvailableSlotResponse getAvailableSlots(
            Long garageId,
            Long servicePackageId,
            String vehicleType,
            LocalDate date);
}