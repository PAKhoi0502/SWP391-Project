package com.autowashpro.repository;

import com.autowashpro.entity.Booking;
import com.autowashpro.entity.User;
import com.autowashpro.entity.Vehicle;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.test.context.ActiveProfiles;

import java.math.BigDecimal;
import java.time.LocalDateTime;

import static org.junit.jupiter.api.Assertions.assertEquals;

@DataJpaTest
@ActiveProfiles("test")
class BookingRepositoryOverlapTest {

    @Autowired
    private BookingRepository bookingRepository;

    @Autowired
    private TestEntityManager entityManager;

    @Test
    void vehicleOverlapCountsOnlyIntersectingActiveBookings() {
        Vehicle vehicle = persistVehicle("0902000001", "51H12345", "CAR");
        LocalDateTime start = slotStart();
        persistBooking(1L, vehicle.getId(), 1L, "CONFIRMED", start, start.plusHours(1), "51H12345");
        persistBooking(1L, vehicle.getId(), 1L, "CANCELED", start, start.plusHours(1), "51H12345");

        long overlapping = bookingRepository.countOverlappingBookingsByVehicle(
                vehicle.getId(), start.plusMinutes(30), start.plusMinutes(90), LocalDateTime.now());
        long adjacent = bookingRepository.countOverlappingBookingsByVehicle(
                vehicle.getId(), start.plusHours(1), start.plusHours(2), LocalDateTime.now());

        assertEquals(1, overlapping);
        assertEquals(0, adjacent);
    }

    @Test
    void garageVehicleTypeOverlapCountsOnlySameVehicleType() {
        Vehicle car = persistVehicle("0902000002", "51H22345", "CAR");
        Vehicle bike = persistVehicle("0902000003", "59A122345", "BIKE");
        LocalDateTime start = slotStart();
        persistBooking(1L, car.getId(), 7L, "CONFIRMED", start, start.plusHours(1), "51H22345");
        persistBooking(2L, bike.getId(), 7L, "CHECKED_IN", start, start.plusHours(1), "59A122345");

        long carOverlaps = bookingRepository.countOverlappingBookingsByGarageAndVehicleType(
                7L, "CAR", start.plusMinutes(15), start.plusMinutes(45), LocalDateTime.now());
        long bikeOverlaps = bookingRepository.countOverlappingBookingsByGarageAndVehicleType(
                7L, "BIKE", start.plusMinutes(15), start.plusMinutes(45), LocalDateTime.now());

        assertEquals(1, carOverlaps);
        assertEquals(1, bikeOverlaps);
    }

    @Test
    void licensePlateOverlapCountsWalkInActiveBookings() {
        LocalDateTime start = slotStart();
        persistBooking(null, null, 3L, "IN_PROGRESS", start, start.plusHours(1), "51H99999");
        persistBooking(null, null, 3L, "NO_SHOW", start, start.plusHours(1), "51H99999");

        long overlaps = bookingRepository.countOverlappingBookingsByLicensePlateAndVehicleType(
                "51H99999", "CAR", start.plusMinutes(10), start.plusMinutes(20), LocalDateTime.now());

        assertEquals(1, overlaps);
    }

    @Test
    void customerGarageOverlapCountsOnlySameCustomerAndGarage() {
        Vehicle vehicle = persistVehicle("0902000004", "51H32345", "CAR");
        LocalDateTime start = slotStart();
        persistBooking(11L, vehicle.getId(), 5L, "CONFIRMED", start, start.plusHours(1), "51H32345");
        persistBooking(11L, vehicle.getId(), 6L, "CONFIRMED", start, start.plusHours(1), "51H32345");

        long sameGarage = bookingRepository.countOverlappingBookingsByCustomerAndGarage(
                11L, 5L, start.plusMinutes(30), start.plusMinutes(90), LocalDateTime.now());
        long otherCustomer = bookingRepository.countOverlappingBookingsByCustomerAndGarage(
                12L, 5L, start.plusMinutes(30), start.plusMinutes(90), LocalDateTime.now());

        assertEquals(1, sameGarage);
        assertEquals(0, otherCustomer);
    }

    private Vehicle persistVehicle(String phone, String plate, String vehicleType) {
        User customer = User.builder()
                .fullName("Repository Customer")
                .email(phone + "@test.local")
                .phone(phone)
                .passwordHash("encoded")
                .role("CUSTOMER")
                .authProvider("LOCAL")
                .isActive(true)
                .build();
        entityManager.persist(customer);

        Vehicle vehicle = new Vehicle();
        vehicle.setCustomer(customer);
        vehicle.setRawLicensePlate(plate);
        vehicle.setNormalizedLicensePlate(plate);
        vehicle.setVehicleType(vehicleType);
        vehicle.setEngineType("GASOLINE");
        vehicle.setBrand("Toyota");
        vehicle.setModel("Vios");
        vehicle.setSeatCount("CAR".equals(vehicleType) ? 5 : null);
        vehicle.setIsDefault(true);
        vehicle.setIsActive(true);
        entityManager.persistAndFlush(vehicle);
        return vehicle;
    }

    private Booking persistBooking(
            Long customerId,
            Long vehicleId,
            Long garageId,
            String status,
            LocalDateTime start,
            LocalDateTime end,
            String licensePlate) {
        Booking booking = new Booking();
        booking.setCustomerId(customerId);
        booking.setVehicleId(vehicleId);
        booking.setGarageId(garageId);
        booking.setServicePackageId(1L);
        Vehicle vehicle = vehicleId != null ? entityManager.find(Vehicle.class, vehicleId) : null;
        booking.setVehicleType(vehicle != null ? vehicle.getVehicleType() : "CAR");
        booking.setBookingDate(start.toLocalDate());
        booking.setStartTime(start);
        booking.setEndTime(end);
        booking.setStatus(status);
        booking.setPaymentStatus("UNPAID");
        booking.setOriginalPrice(new BigDecimal("100000.00"));
        booking.setSurchargeAmount(BigDecimal.ZERO);
        booking.setDiscountAmount(BigDecimal.ZERO);
        booking.setPromotionDiscountAmount(BigDecimal.ZERO);
        booking.setFinalPrice(new BigDecimal("100000.00"));
        booking.setDepositAmount(BigDecimal.ZERO);
        booking.setDepositStatus("UNPAID");
        booking.setRefundAmount(BigDecimal.ZERO);
        booking.setIsWalkIn(vehicleId == null);
        booking.setLicensePlate(licensePlate);
        booking.setRewardProcessed(false);
        booking.setUsedPoints(0);
        entityManager.persistAndFlush(booking);
        return booking;
    }

    private LocalDateTime slotStart() {
        return LocalDateTime.now().plusDays(2).withHour(9).withMinute(0).withSecond(0).withNano(0);
    }
}
