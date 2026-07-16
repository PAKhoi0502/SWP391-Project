package com.autowashpro.support;

import com.autowashpro.dto.request.BookingCreateRequest;
import com.autowashpro.dto.request.CreateServicePackageRequest;
import com.autowashpro.dto.request.CreateServicePackageStepRequest;
import com.autowashpro.dto.request.GarageCreateRequest;
import com.autowashpro.dto.request.RegisterRequest;
import com.autowashpro.dto.request.VehicleCreateRequest;
import com.autowashpro.dto.request.WashBayCreateRequest;
import com.autowashpro.entity.Booking;
import com.autowashpro.entity.CustomerLoyalty;
import com.autowashpro.entity.Garage;
import com.autowashpro.entity.LoyaltyTierRule;
import com.autowashpro.entity.ServicePackage;
import com.autowashpro.entity.StaffProfile;
import com.autowashpro.entity.User;
import com.autowashpro.entity.Vehicle;
import com.autowashpro.entity.WashBay;
import com.autowashpro.entity.enums.StaffType;
import com.autowashpro.entity.enums.WashBayStatus;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.List;

public final class TestFixtures {

    public static final LocalDateTime BASE_TIME = LocalDateTime.of(2026, 7, 10, 9, 0);

    private TestFixtures() {
    }

    public static User customer() {
        return user(1L, "Customer Test", "customer@test.local", "0901000001", "CUSTOMER");
    }

    public static User staff() {
        return user(2L, "Staff Test", "staff@test.local", "0901000002", "STAFF");
    }

    public static User admin() {
        return user(3L, "Admin Test", "admin@test.local", "0901000003", "ADMIN");
    }

    public static User user(Long id, String fullName, String email, String phone, String role) {
        return User.builder()
                .id(id)
                .fullName(fullName)
                .email(email)
                .phone(phone)
                .passwordHash("encoded-password")
                .role(role)
                .authProvider("LOCAL")
                .isActive(true)
                .createdAt(BASE_TIME.minusDays(30))
                .updatedAt(BASE_TIME.minusDays(30))
                .build();
    }

    public static RegisterRequest registerRequest() {
        return new RegisterRequest(
                "New Customer",
                "new.customer@test.local",
                "0901999999",
                "password123"
        );
    }

    public static Garage garage() {
        Garage garage = new Garage();
        garage.setId(1L);
        garage.setName("AutoWash Test Garage");
        garage.setGarageCode("TEST-GARAGE");
        garage.setAddress("100 Test Street");
        garage.setCity("Ho Chi Minh City");
        garage.setPhone("0287000001");
        garage.setOpeningTime(LocalTime.of(7, 0));
        garage.setClosingTime(LocalTime.of(21, 0));
        garage.setSlotIntervalMinutes(30);
        garage.setIsActive(true);
        garage.setCreatedAt(BASE_TIME.minusDays(30));
        garage.setUpdatedAt(BASE_TIME.minusDays(30));
        return garage;
    }

    public static GarageCreateRequest garageCreateRequest() {
        GarageCreateRequest request = new GarageCreateRequest();
        request.setName("AutoWash Test Garage");
        request.setGarageCode("TEST-GARAGE");
        request.setAddress("100 Test Street");
        request.setCity("Ho Chi Minh City");
        request.setPhone("0287000001");
        request.setOpeningTime(LocalTime.of(7, 0));
        request.setClosingTime(LocalTime.of(21, 0));
        request.setSlotIntervalMinutes(30);
        return request;
    }

    public static Vehicle car(User customer) {
        Vehicle vehicle = new Vehicle();
        vehicle.setId(1L);
        vehicle.setCustomer(customer);
        vehicle.setRawLicensePlate("51H-123.45");
        vehicle.setNormalizedLicensePlate("51H12345");
        vehicle.setVehicleType("CAR");
        vehicle.setEngineType("GASOLINE");
        vehicle.setBrand("Toyota");
        vehicle.setModel("Vios");
        vehicle.setColor("White");
        vehicle.setSeatCount(5);
        vehicle.setIsDefault(true);
        vehicle.setIsActive(true);
        vehicle.setCreatedAt(BASE_TIME.minusDays(20));
        vehicle.setUpdatedAt(BASE_TIME.minusDays(20));
        return vehicle;
    }

    public static VehicleCreateRequest vehicleCreateRequest() {
        VehicleCreateRequest request = new VehicleCreateRequest();
        request.setRawLicensePlate("51H-123.45");
        request.setVehicleType("CAR");
        request.setEngineType("GASOLINE");
        request.setBrand("Toyota");
        request.setModel("Vios");
        request.setColor("White");
        request.setSeatCount(5);
        request.setIsDefault(false);
        return request;
    }

    public static ServicePackage carWashPackage() {
        return ServicePackage.builder()
                .id(1L)
                .name("Car Basic Wash")
                .code("CAR-BASIC")
                .vehicleType("CAR")
                .serviceType("MAIN")
                .basePrice(new BigDecimal("120000.00"))
                .durationMinutes(45)
                .washBayDurationMinutes(30)
                .pointsEarned(20)
                .requiresWashBay(true)
                .requiresCareStaff(true)
                .careStaffType("VEHICLE_CARE_STAFF")
                .careStaffRequiredCount(1)
                .careStaffDurationMinutes(45)
                .isActive(true)
                .createdAt(BASE_TIME.minusDays(30))
                .updatedAt(BASE_TIME.minusDays(30))
                .build();
    }

    public static CreateServicePackageRequest servicePackageCreateRequest() {
        CreateServicePackageStepRequest step = new CreateServicePackageStepRequest(
                1,
                "Foam wash",
                "Apply foam and clean exterior",
                true,
                List.of("Apply foam", "Rinse vehicle")
        );

        CreateServicePackageRequest request = new CreateServicePackageRequest();
        request.setName("Car Basic Wash");
        request.setCode("CAR-BASIC");
        request.setVehicleType("CAR");
        request.setServiceType("MAIN");
        request.setBasePrice(new BigDecimal("120000.00"));
        request.setDurationMinutes(45);
        request.setWashBayDurationMinutes(30);
        request.setPointsEarned(20);
        request.setRequiresWashBay(true);
        request.setRequiresCareStaff(true);
        request.setCareStaffType("VEHICLE_CARE_STAFF");
        request.setCareStaffRequiredCount(1);
        request.setCareStaffDurationMinutes(45);
        request.setIncludedServiceIds(List.of());
        request.setSteps(List.of(step));
        return request;
    }

    public static WashBay washBay(Garage garage) {
        WashBay washBay = new WashBay();
        washBay.setId(1L);
        washBay.setGarageId(garage.getId());
        washBay.setBayCode("CAR-01");
        washBay.setVehicleType("CAR");
        washBay.setStatus(WashBayStatus.AVAILABLE);
        washBay.setIsActive(true);
        washBay.setCreatedAt(BASE_TIME.minusDays(30));
        washBay.setUpdatedAt(BASE_TIME.minusDays(30));
        return washBay;
    }

    public static WashBayCreateRequest washBayCreateRequest(Garage garage) {
        WashBayCreateRequest request = new WashBayCreateRequest();
        request.setGarageId(garage.getId());
        request.setName("CAR-01");
        request.setVehicleType("CAR");
        return request;
    }

    public static StaffProfile careStaff(User staff, Garage garage) {
        StaffProfile profile = new StaffProfile();
        profile.setId(1L);
        profile.setUser(staff);
        profile.setGarageId(garage.getId());
        profile.setStaffCode("CARE-001");
        profile.setStaffType(StaffType.VEHICLE_CARE_STAFF);
        profile.setIsActive(true);
        profile.setCreatedAt(BASE_TIME.minusDays(30));
        profile.setUpdatedAt(BASE_TIME.minusDays(30));
        return profile;
    }

    public static LoyaltyTierRule bronzeTierRule() {
        LoyaltyTierRule rule = new LoyaltyTierRule();
        rule.setId(1L);
        rule.setTier("BRONZE");
        rule.setMinTotalSpent(BigDecimal.ZERO);
        rule.setMinTotalVisits(0);
        rule.setMinTotalPoints(0);
        rule.setBookingWindowDays(7);
        rule.setMaxUpcomingBookings(2);
        rule.setPointMultiplier(BigDecimal.ONE);
        rule.setPriorityLevel(1);
        rule.setIsActive(true);
        return rule;
    }

    public static CustomerLoyalty loyalty(User customer) {
        CustomerLoyalty loyalty = new CustomerLoyalty();
        loyalty.setId(1L);
        loyalty.setCustomerId(customer.getId());
        loyalty.setCurrentTier("BRONZE");
        loyalty.setTotalPoints(100);
        loyalty.setAvailablePoints(100);
        loyalty.setRedeemedPoints(0);
        loyalty.setExpiredPoints(0);
        loyalty.setTotalSpent(new BigDecimal("120000.00"));
        loyalty.setTotalVisits(1);
        loyalty.setCurrentCycleSpent(new BigDecimal("120000.00"));
        loyalty.setCurrentCycleVisits(1);
        loyalty.setCreatedAt(BASE_TIME.minusDays(30));
        loyalty.setUpdatedAt(BASE_TIME.minusDays(1));
        return loyalty;
    }

    public static Booking confirmedBooking(User customer, Vehicle vehicle, Garage garage, ServicePackage servicePackage) {
        Booking booking = new Booking();
        booking.setId(1L);
        booking.setCustomerId(customer.getId());
        booking.setVehicleId(vehicle.getId());
        booking.setGarageId(garage.getId());
        booking.setServicePackageId(servicePackage.getId());
        booking.setBookingDate(BASE_TIME.toLocalDate());
        booking.setStartTime(BASE_TIME);
        booking.setEndTime(BASE_TIME.plusMinutes(servicePackage.getDurationMinutes()));
        booking.setStatus("CONFIRMED");
        booking.setPaymentStatus("UNPAID");
        booking.setOriginalPrice(servicePackage.getBasePrice());
        booking.setSurchargeAmount(BigDecimal.ZERO);
        booking.setDiscountAmount(BigDecimal.ZERO);
        booking.setPromotionDiscountAmount(BigDecimal.ZERO);
        booking.setFinalPrice(servicePackage.getBasePrice());
        booking.setDepositAmount(new BigDecimal("36000.00"));
        booking.setDepositStatus("UNPAID");
        booking.setRefundAmount(BigDecimal.ZERO);
        booking.setIsWalkIn(false);
        booking.setRewardProcessed(false);
        booking.setUsedPoints(0);
        booking.setCreatedAt(BASE_TIME.minusDays(2));
        booking.setUpdatedAt(BASE_TIME.minusDays(2));
        return booking;
    }

    public static BookingCreateRequest bookingCreateRequest(Garage garage, Vehicle vehicle, ServicePackage servicePackage) {
        BookingCreateRequest request = new BookingCreateRequest();
        request.setGarageId(garage.getId());
        request.setVehicleId(vehicle.getId());
        request.setServicePackageId(servicePackage.getId());
        request.setStartTime(BASE_TIME);
        request.setUsedPoints(0);
        request.setNote("Test booking");
        return request;
    }
}
