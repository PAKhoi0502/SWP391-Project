package com.autowashpro.service.impl;

import com.autowashpro.dto.request.ResearchExportFilterRequest;
import com.autowashpro.dto.response.ResearchExportFile;
import com.autowashpro.entity.Booking;
import com.autowashpro.entity.CustomerLoyalty;
import com.autowashpro.entity.Garage;
import com.autowashpro.entity.PromotionUsage;
import com.autowashpro.entity.ServicePackage;
import com.autowashpro.entity.User;
import com.autowashpro.entity.Vehicle;
import com.autowashpro.service.ResearchExportService;
import com.autowashpro.service.support.ResearchAnonymizer;
import com.autowashpro.service.support.ResearchExportWriter;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.autoconfigure.orm.jpa.TestEntityManager;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

@DataJpaTest
@ActiveProfiles("test")
@Import({
        ResearchExportServiceImpl.class,
        ResearchAnonymizer.class,
        ResearchExportWriter.class,
        ResearchExportServiceImplTest.JsonConfiguration.class
})
class ResearchExportServiceImplTest {

    private static final LocalDate FROM = LocalDate.of(2026, 6, 1);
    private static final LocalDate TO = LocalDate.of(2026, 6, 30);

    @Autowired
    private ResearchExportService researchExportService;

    @Autowired
    private TestEntityManager entityManager;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    void bookingExportContainsResearchFieldsWithoutDirectIdentifiers() throws Exception {
        User customer = persistCustomer(
                "Sensitive Customer Name",
                "sensitive.customer@example.com",
                "0909123456");
        Vehicle vehicle = persistVehicle(customer, "51H-SECRET", "51HSECRET");
        Garage garage = persistGarage("BOOKING", "123 Sensitive Address", "Ho Chi Minh City");
        ServicePackage servicePackage = persistServicePackage("BOOKING");
        persistLoyalty(customer, "GOLD");
        Booking booking = persistBooking(
                customer.getId(),
                null,
                vehicle.getId(),
                garage.getId(),
                servicePackage.getId(),
                LocalDateTime.of(2026, 6, 10, 9, 30),
                "COMPLETED",
                "PAID",
                new BigDecimal("180000.00"),
                20,
                false,
                "51H-SECRET");
        booking.setWashBayId(9L);
        entityManager.persistAndFlush(booking);
        persistPromotionUsage(booking, customer.getId());

        ResearchExportFile jsonFile = researchExportService.exportBookings(filter("json"));
        String json = new String(jsonFile.content(), StandardCharsets.UTF_8);
        JsonNode row = objectMapper.readTree(json).get(0);

        assertEquals("application/json", jsonFile.contentType());
        assertEquals("CAR", row.get("vehicle_type").asText());
        assertEquals("Ho Chi Minh City", row.get("garage_area").asText());
        assertEquals("MAIN", row.get("service_type").asText());
        assertEquals("2026-06", row.get("booking_month").asText());
        assertEquals("MORNING", row.get("time_bucket").asText());
        assertEquals("GOLD", row.get("loyalty_tier").asText());
        assertTrue(row.get("customer_anonymous_id").asText().startsWith("customer_"));
        assertTrue(row.get("booking_anonymous_id").asText().startsWith("booking_"));
        assertTrue(row.get("promotion_used").asBoolean());
        assertTrue(row.get("wash_bay_used").asBoolean());
        assertNoSensitiveData(json);
        assertFalse(json.contains("\"customer_id\""));
        assertFalse(json.contains("\"booking_id\""));

        ResearchExportFile csvFile = researchExportService.exportBookings(filter("csv"));
        String csv = new String(csvFile.content(), StandardCharsets.UTF_8);

        assertEquals("text/csv;charset=UTF-8", csvFile.contentType());
        assertTrue(csv.startsWith("booking_anonymous_id,customer_anonymous_id,customer_type"));
        assertTrue(csv.contains(row.get("customer_anonymous_id").asText()));
        List<String> jsonFields = new ArrayList<>();
        row.fieldNames().forEachRemaining(jsonFields::add);
        List<String> csvFields = Arrays.stream(csv.lines().findFirst().orElseThrow().split(","))
                .map(field -> field.replace("\"", ""))
                .toList();
        assertEquals(jsonFields, csvFields);
        assertNoSensitiveData(csv);
    }

    @Test
    void customerExportAggregatesBehaviorAndCountsOnlyCompletedPaidSpending() throws Exception {
        User customer = persistCustomer("Research Customer", "research@example.com", "0908000001");
        Vehicle vehicle = persistVehicle(customer, "30A-111.11", "30A11111");
        Garage garage = persistGarage("CUSTOMER", "45 Private Street", "Ha Noi");
        ServicePackage servicePackage = persistServicePackage("CUSTOMER");
        persistLoyalty(customer, "SILVER");

        Booking paid = persistBooking(
                customer.getId(), null, vehicle.getId(), garage.getId(), servicePackage.getId(),
                LocalDateTime.of(2026, 6, 5, 9, 0), "COMPLETED", "PAID",
                new BigDecimal("100000.00"), 10, false, null);
        persistPromotionUsage(paid, customer.getId());
        persistBooking(
                customer.getId(), null, vehicle.getId(), garage.getId(), servicePackage.getId(),
                LocalDateTime.of(2026, 6, 6, 10, 0), "CANCELED", "PAID",
                new BigDecimal("500000.00"), 0, false, null);
        persistBooking(
                customer.getId(), null, vehicle.getId(), garage.getId(), servicePackage.getId(),
                LocalDateTime.of(2026, 6, 7, 19, 0), "COMPLETED", "UNPAID",
                new BigDecimal("200000.00"), 5, false, null);
        persistBooking(
                customer.getId(), null, vehicle.getId(), garage.getId(), servicePackage.getId(),
                LocalDateTime.of(2026, 5, 20, 9, 0), "COMPLETED", "PAID",
                new BigDecimal("900000.00"), 0, false, null);
        long bookingCount = count("Booking");

        ResearchExportFile file = researchExportService.exportCustomers(filter("json"));
        JsonNode rows = objectMapper.readTree(file.content());
        JsonNode row = rows.get(0);

        assertEquals(1, rows.size());
        assertEquals(3L, row.get("total_bookings").asLong());
        assertEquals(2L, row.get("completed_bookings").asLong());
        assertEquals(1L, row.get("canceled_bookings").asLong());
        assertEquals(1L, row.get("paid_bookings").asLong());
        assertEquals(0, new BigDecimal(row.get("total_spent").asText()).compareTo(new BigDecimal("100000.00")));
        assertEquals(0, new BigDecimal(row.get("average_spent").asText()).compareTo(new BigDecimal("100000.00")));
        assertEquals(1L, row.get("promotion_usage_count").asLong());
        assertEquals(15, row.get("points_redeemed").asInt());
        assertEquals("CAR", row.get("primary_vehicle_type").asText());
        assertEquals("MORNING", row.get("preferred_time_bucket").asText());
        assertEquals(1, row.get("active_months").asInt());
        assertEquals(bookingCount, count("Booking"));
    }

    @Test
    void walkInCustomersUseStableAnonymousIdWithoutExposingPhoneOrPlate() throws Exception {
        Garage garage = persistGarage("WALKIN", "90 Hidden Avenue", "Da Nang");
        ServicePackage servicePackage = persistServicePackage("WALKIN");
        persistBooking(
                null, "0912 345 678", null, garage.getId(), servicePackage.getId(),
                LocalDateTime.of(2026, 6, 12, 8, 0), "COMPLETED", "PAID",
                new BigDecimal("80000.00"), 0, true, "43A-SECRET1");
        persistBooking(
                null, "0912-345-678", null, garage.getId(), servicePackage.getId(),
                LocalDateTime.of(2026, 6, 20, 8, 0), "COMPLETED", "PAID",
                new BigDecimal("90000.00"), 0, true, "43A-SECRET2");

        ResearchExportFile file = researchExportService.exportCustomers(filter("json"));
        String json = new String(file.content(), StandardCharsets.UTF_8);
        JsonNode rows = objectMapper.readTree(json);

        assertEquals(1, rows.size());
        assertEquals("WALK_IN", rows.get(0).get("customer_type").asText());
        assertEquals("NONE", rows.get(0).get("loyalty_tier").asText());
        assertEquals(2L, rows.get(0).get("total_bookings").asLong());
        assertFalse(json.contains("0912"));
        assertFalse(json.contains("43A-SECRET"));
    }

    @Test
    void validatesRangeAndFormat() {
        ResponseStatusException missing = assertThrows(
                ResponseStatusException.class,
                () -> researchExportService.exportBookings(filter(null, TO, "csv")));
        ResponseStatusException reversed = assertThrows(
                ResponseStatusException.class,
                () -> researchExportService.exportBookings(filter(TO, FROM, "csv")));
        ResponseStatusException tooLarge = assertThrows(
                ResponseStatusException.class,
                () -> researchExportService.exportBookings(filter(
                        LocalDate.of(2025, 1, 1), LocalDate.of(2026, 1, 2), "csv")));
        ResponseStatusException unsupported = assertThrows(
                ResponseStatusException.class,
                () -> researchExportService.exportBookings(filter("xml")));

        assertEquals(400, missing.getStatusCode().value());
        assertEquals(400, reversed.getStatusCode().value());
        assertEquals(400, tooLarge.getStatusCode().value());
        assertEquals(400, unsupported.getStatusCode().value());
    }

    @Test
    void emptyCsvStillContainsConsistentHeader() {
        ResearchExportFile file = researchExportService.exportCustomers(filter(null));
        String csv = new String(file.content(), StandardCharsets.UTF_8);

        assertTrue(file.filename().endsWith(".csv"));
        assertTrue(csv.startsWith("customer_anonymous_id,customer_type,loyalty_tier"));
    }

    private ResearchExportFilterRequest filter(String format) {
        return filter(FROM, TO, format);
    }

    private ResearchExportFilterRequest filter(LocalDate from, LocalDate to, String format) {
        return ResearchExportFilterRequest.builder()
                .from(from)
                .to(to)
                .format(format)
                .build();
    }

    private User persistCustomer(String name, String email, String phone) {
        User user = User.builder()
                .fullName(name)
                .email(email)
                .phone(phone)
                .passwordHash("encoded-password")
                .role("CUSTOMER")
                .isActive(true)
                .createdAt(LocalDateTime.of(2026, 1, 1, 0, 0))
                .updatedAt(LocalDateTime.of(2026, 1, 1, 0, 0))
                .build();
        return entityManager.persistAndFlush(user);
    }

    private Vehicle persistVehicle(User customer, String rawPlate, String normalizedPlate) {
        Vehicle vehicle = new Vehicle();
        vehicle.setCustomer(customer);
        vehicle.setRawLicensePlate(rawPlate);
        vehicle.setNormalizedLicensePlate(normalizedPlate);
        vehicle.setVehicleType("CAR");
        vehicle.setEngineType("GASOLINE");
        vehicle.setBrand("Toyota");
        vehicle.setModel("Vios");
        vehicle.setColor("White");
        vehicle.setSeatCount(5);
        vehicle.setIsDefault(true);
        vehicle.setIsActive(true);
        return entityManager.persistAndFlush(vehicle);
    }

    private Garage persistGarage(String suffix, String address, String city) {
        Garage garage = new Garage();
        garage.setName("Research Garage " + suffix);
        garage.setGarageCode("RESEARCH-" + suffix);
        garage.setAddress(address);
        garage.setCity(city);
        garage.setPhone("02870000" + Math.abs(suffix.hashCode() % 100));
        garage.setOpeningTime(LocalTime.of(7, 0));
        garage.setClosingTime(LocalTime.of(21, 0));
        garage.setSlotIntervalMinutes(30);
        garage.setIsActive(true);
        return entityManager.persistAndFlush(garage);
    }

    private ServicePackage persistServicePackage(String suffix) {
        ServicePackage servicePackage = ServicePackage.builder()
                .name("Research Wash " + suffix)
                .code("RESEARCH-" + suffix)
                .vehicleType("CAR")
                .serviceType("MAIN")
                .basePrice(new BigDecimal("100000.00"))
                .durationMinutes(60)
                .washBayDurationMinutes(45)
                .pointsEarned(10)
                .requiresWashBay(true)
                .requiresCareStaff(false)
                .isActive(true)
                .build();
        return entityManager.persistAndFlush(servicePackage);
    }

    private void persistLoyalty(User customer, String tier) {
        CustomerLoyalty loyalty = new CustomerLoyalty();
        loyalty.setCustomerId(customer.getId());
        loyalty.setCurrentTier(tier);
        loyalty.setTotalPoints(100);
        loyalty.setAvailablePoints(80);
        loyalty.setRedeemedPoints(20);
        loyalty.setExpiredPoints(0);
        loyalty.setTotalSpent(new BigDecimal("500000.00"));
        loyalty.setTotalVisits(5);
        loyalty.setCurrentCycleSpent(new BigDecimal("500000.00"));
        loyalty.setCurrentCycleVisits(5);
        entityManager.persistAndFlush(loyalty);
    }

    private Booking persistBooking(
            Long customerId,
            String guestPhone,
            Long vehicleId,
            Long garageId,
            Long servicePackageId,
            LocalDateTime startTime,
            String status,
            String paymentStatus,
            BigDecimal finalPrice,
            int usedPoints,
            boolean walkIn,
            String licensePlate) {
        Booking booking = new Booking();
        booking.setCustomerId(customerId);
        booking.setGuestName(walkIn ? "Walk In Sensitive Name" : null);
        booking.setGuestPhone(guestPhone);
        booking.setLicensePlate(licensePlate);
        booking.setVehicleId(vehicleId);
        booking.setGarageId(garageId);
        booking.setServicePackageId(servicePackageId);
        booking.setBookingDate(startTime.toLocalDate());
        booking.setStartTime(startTime);
        booking.setEndTime(startTime.plusMinutes(60));
        booking.setStatus(status);
        booking.setPaymentStatus(paymentStatus);
        booking.setPaymentMethod("PAID".equals(paymentStatus) ? "CASH" : null);
        booking.setOriginalPrice(finalPrice);
        booking.setSurchargeAmount(BigDecimal.ZERO);
        booking.setDiscountAmount(new BigDecimal("10000.00"));
        booking.setPromotionDiscountAmount(BigDecimal.ZERO);
        booking.setFinalPrice(finalPrice);
        booking.setDepositAmount(BigDecimal.ZERO);
        booking.setDepositStatus("UNPAID");
        booking.setRefundAmount(BigDecimal.ZERO);
        booking.setIsWalkIn(walkIn);
        booking.setRewardProcessed(false);
        booking.setUsedPoints(usedPoints);
        if ("COMPLETED".equals(status)) {
            booking.setCompletedAt(startTime.plusMinutes(60));
        }
        if ("PAID".equals(paymentStatus)) {
            booking.setPaidAt(startTime.plusMinutes(70));
        }
        return entityManager.persistAndFlush(booking);
    }

    private void persistPromotionUsage(Booking booking, Long customerId) {
        PromotionUsage usage = new PromotionUsage();
        usage.setPromotionId(1L);
        usage.setBookingId(booking.getId());
        usage.setCustomerId(customerId);
        usage.setDiscountAmount(new BigDecimal("10000.00"));
        usage.setUsedAt(booking.getStartTime());
        entityManager.persistAndFlush(usage);
    }

    private long count(String entityName) {
        return entityManager.getEntityManager()
                .createQuery("SELECT COUNT(e) FROM " + entityName + " e", Long.class)
                .getSingleResult();
    }

    private void assertNoSensitiveData(String export) {
        assertFalse(export.contains("Sensitive Customer Name"));
        assertFalse(export.contains("sensitive.customer@example.com"));
        assertFalse(export.contains("0909123456"));
        assertFalse(export.contains("51H-SECRET"));
        assertFalse(export.contains("123 Sensitive Address"));
    }

    @TestConfiguration
    static class JsonConfiguration {
        @Bean
        ObjectMapper objectMapper() {
            return new ObjectMapper().registerModule(new JavaTimeModule());
        }
    }
}
