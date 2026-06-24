package com.autowashpro.service.impl;

import com.autowashpro.dto.response.AvailableSlotResponse;
import com.autowashpro.dto.response.SlotResponse;
import com.autowashpro.entity.Booking;
import com.autowashpro.entity.Garage;
import com.autowashpro.entity.ServicePackage;
import com.autowashpro.repository.BookingRepository;
import com.autowashpro.repository.GarageRepository;
import com.autowashpro.repository.ServicePackageRepository;
import com.autowashpro.repository.WashBayRepository;
import com.autowashpro.service.BookingService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
public class BookingServiceImpl implements BookingService {

        private final GarageRepository garageRepository;

        private final ServicePackageRepository servicePackageRepository;

        private final WashBayRepository washBayRepository;

        private final BookingRepository bookingRepository;

        @Override
        public AvailableSlotResponse getAvailableSlots(
                        Long garageId,
                        Long servicePackageId,
                        String vehicleType,
                        LocalDate date) {

                Garage garage = garageRepository.findById(garageId)
                                .orElseThrow(() -> new RuntimeException("Garage not found"));

                ServicePackage servicePackage = servicePackageRepository.findById(servicePackageId)
                                .orElseThrow(() -> new RuntimeException("Service package not found"));

                if (!servicePackage.getVehicleType().equals(vehicleType)) {
                        throw new RuntimeException(
                                        "Service package does not support vehicle type: "
                                                        + vehicleType);
                }

                List<String> supportedVehicleTypes = washBayRepository.findDistinctVehicleTypesByGarageId(
                                garageId);

                String bayType = mapVehicleTypeToBayType(vehicleType);
                long availableBayCount = washBayRepository.countAvailableByGarageAndVehicleType(
                                garageId,
                                bayType);

                if (!supportedVehicleTypes.contains(bayType)) {
                        throw new RuntimeException(
                                        "Garage does not support vehicle type: "
                                                        + vehicleType);
                }

                List<SlotResponse> slots = new ArrayList<>();

                List<Booking> bookings = bookingRepository.findByGarageIdAndStartTimeBetween(
                                garageId,
                                date.atStartOfDay(),
                                date.plusDays(1).atStartOfDay());

                LocalTime current = garage.getOpeningTime();

                while (current.plusMinutes(servicePackage.getDurationMinutes())
                                .isBefore(garage.getClosingTime())
                                ||
                                current.plusMinutes(servicePackage.getDurationMinutes())
                                                .equals(garage.getClosingTime())) {

                        LocalDateTime start = LocalDateTime.of(date, current);

                        LocalDateTime end = start.plusMinutes(
                                        servicePackage.getDurationMinutes());

                        boolean available = availableBayCount > 0;;

                        for (Booking booking : bookings) {

                                String status = booking.getStatus();

                                boolean holdCapacity = "CONFIRMED".equals(status)
                                                || "CHECKED_IN".equals(status)
                                                || "IN_PROGRESS".equals(status);

                                if (!holdCapacity) {
                                        continue;
                                }

                                boolean overlap = start.isBefore(booking.getEndTime())
                                                &&
                                                end.isAfter(booking.getStartTime());

                                if (overlap) {
                                        available = false;
                                        break;
                                }
                        }

                        slots.add(
                                        SlotResponse.builder()
                                                        .startTime(start)
                                                        .endTime(end)
                                                        .available(available)
                                                        .build());

                        current = current.plusMinutes(
                                        garage.getSlotIntervalMinutes());
                }

                return AvailableSlotResponse.builder()
                                .garageId(garageId)
                                .servicePackageId(servicePackageId)
                                .date(date)
                                .slots(slots)
                                .build();
        }

        private String mapVehicleTypeToBayType(String vehicleType) {

                if (vehicleType.startsWith("BIKE")) {
                        return "BIKE";
                }

                return "CAR";
        }
}