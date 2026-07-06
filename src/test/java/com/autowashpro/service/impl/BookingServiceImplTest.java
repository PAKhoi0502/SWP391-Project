package com.autowashpro.service.impl;

import com.autowashpro.dto.request.BookingCreateRequest;
import com.autowashpro.dto.request.CompleteBookingServiceStepRequest;
import com.autowashpro.dto.request.MarkBookingPaidRequest;
import com.autowashpro.dto.request.StartServiceRequest;
import com.autowashpro.dto.request.WalkInBookingCreateRequest;
import com.autowashpro.dto.response.BookingResponse;
import com.autowashpro.dto.response.BookingServiceStepResponse;
import com.autowashpro.dto.response.PromotionValidateResponse;
import com.autowashpro.entity.Booking;
import com.autowashpro.entity.BookingAddOnServicePackage;
import com.autowashpro.entity.BookingAssignedStaff;
import com.autowashpro.entity.BookingServiceStep;
import com.autowashpro.entity.CustomerLoyalty;
import com.autowashpro.entity.Garage;
import com.autowashpro.entity.LoyaltyTierRule;
import com.autowashpro.entity.PointTransaction;
import com.autowashpro.entity.Promotion;
import com.autowashpro.entity.PromotionUsage;
import com.autowashpro.entity.ServicePackage;
import com.autowashpro.entity.ServicePackageStep;
import com.autowashpro.entity.StaffProfile;
import com.autowashpro.entity.User;
import com.autowashpro.entity.Vehicle;
import com.autowashpro.entity.WashBay;
import com.autowashpro.entity.enums.StaffType;
import com.autowashpro.entity.enums.WashBayStatus;
import com.autowashpro.repository.BookingAddOnServicePackageRepository;
import com.autowashpro.repository.BookingAssignedStaffRepository;
import com.autowashpro.repository.BookingRepository;
import com.autowashpro.repository.BookingServiceStepRepository;
import com.autowashpro.repository.CustomerLoyaltyRepository;
import com.autowashpro.repository.GarageRepository;
import com.autowashpro.repository.LoyaltyTierRuleRepository;
import com.autowashpro.repository.PointTransactionRepository;
import com.autowashpro.repository.PromotionRepository;
import com.autowashpro.repository.PromotionUsageRepository;
import com.autowashpro.repository.ServicePackageRepository;
import com.autowashpro.repository.ServicePackageStepRepository;
import com.autowashpro.repository.StaffProfileRepository;
import com.autowashpro.repository.UserRepository;
import com.autowashpro.repository.VehicleRepository;
import com.autowashpro.repository.WashBayRepository;
import com.autowashpro.service.EmailService;
import com.autowashpro.service.LoyaltyService;
import com.autowashpro.service.NotificationService;
import com.autowashpro.service.PromotionService;
import com.autowashpro.service.WashHistoryService;
import com.autowashpro.support.TestFixtures;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class BookingServiceImplTest {

    @Mock
    private GarageRepository garageRepository;

    @Mock
    private ServicePackageRepository servicePackageRepository;

    @Mock
    private WashBayRepository washBayRepository;

    @Mock
    private BookingRepository bookingRepository;

    @Mock
    private VehicleRepository vehicleRepository;

    @Mock
    private CustomerLoyaltyRepository customerLoyaltyRepository;

    @Mock
    private LoyaltyTierRuleRepository loyaltyTierRuleRepository;

    @Mock
    private PromotionRepository promotionRepository;

    @Mock
    private PromotionUsageRepository promotionUsageRepository;

    @Mock
    private BookingAssignedStaffRepository bookingAssignedStaffRepository;

    @Mock
    private StaffProfileRepository staffProfileRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private BookingServiceStepRepository bookingServiceStepRepository;

    @Mock
    private ServicePackageStepRepository servicePackageStepRepository;

    @Mock
    private ComboStepResolver comboStepResolver;

    @Mock
    private BookingAddOnServicePackageRepository bookingAddOnServicePackageRepository;

    @Mock
    private PointTransactionRepository pointTransactionRepository;

    @Mock
    private LoyaltyService loyaltyService;

    @Mock
    private WashHistoryService washHistoryService;

    @Mock
    private PromotionService promotionService;

    @Mock
    private NotificationService notificationService;

    @Mock
    private EmailService emailService;

    @InjectMocks
    private BookingServiceImpl bookingService;

    @BeforeEach
    void setUp() {
        lenient().when(bookingAddOnServicePackageRepository.findByBookingIdOrderBySortOrderAsc(anyLong()))
                .thenReturn(List.of());
        lenient().when(bookingAssignedStaffRepository.findByBookingId(anyLong()))
                .thenReturn(List.of());
        lenient().when(pointTransactionRepository.findByBookingIdAndType(anyLong(), eq("EARN")))
                .thenReturn(Optional.empty());
        lenient().when(promotionUsageRepository.existsByBookingId(anyLong())).thenReturn(false);
        lenient().when(bookingRepository.save(any(Booking.class))).thenAnswer(invocation -> {
            Booking booking = invocation.getArgument(0);
            if (booking.getId() == null) {
                booking.setId(10L);
            }
            return booking;
        });
    }

    @Test
    void createBookingHappyPathConfirmsBooking() {
        User customer = TestFixtures.customer();
        Vehicle vehicle = TestFixtures.car(customer);
        Garage garage = TestFixtures.garage();
        ServicePackage servicePackage = mainPackage();
        BookingCreateRequest request = bookingRequest(garage, vehicle, servicePackage);
        stubSuccessfulBookingCreate(customer, vehicle, garage, servicePackage);

        BookingResponse response = bookingService.createBooking(request, customer.getId());

        assertEquals("CONFIRMED", response.getStatus());
        assertMoney("120000.00", response.getOriginalPrice());
        assertMoney("120000.00", response.getFinalPrice());
        assertMoney("36000.00", response.getDepositAmount());
        assertFalse(response.getIsWalkIn());
        verify(loyaltyService).updateBookingStatistics(10L);
        verify(notificationService).notifyBookingConfirmed(10L);
    }

    @Test
    void createBookingRejectsInvalidTime() {
        User customer = TestFixtures.customer();
        Vehicle vehicle = TestFixtures.car(customer);
        Garage garage = TestFixtures.garage();
        ServicePackage servicePackage = mainPackage();
        BookingCreateRequest request = bookingRequest(garage, vehicle, servicePackage);
        request.setStartTime(LocalDateTime.now().minusMinutes(5));
        stubSuccessfulBookingCreate(customer, vehicle, garage, servicePackage);

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> bookingService.createBooking(request, customer.getId()));

        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
        verify(bookingRepository, never()).save(any());
    }

    @Test
    void createBookingRejectsMissingGarage() {
        User customer = TestFixtures.customer();
        Vehicle vehicle = TestFixtures.car(customer);
        ServicePackage servicePackage = mainPackage();
        BookingCreateRequest request = bookingRequest(TestFixtures.garage(), vehicle, servicePackage);
        when(userRepository.findById(customer.getId())).thenReturn(Optional.of(customer));
        when(vehicleRepository.findByIdAndCustomer_Id(vehicle.getId(), customer.getId())).thenReturn(Optional.of(vehicle));
        when(servicePackageRepository.findById(servicePackage.getId())).thenReturn(Optional.of(servicePackage));
        when(garageRepository.findById(request.getGarageId())).thenReturn(Optional.empty());

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> bookingService.createBooking(request, customer.getId()));

        assertEquals(HttpStatus.NOT_FOUND, error.getStatusCode());
    }

    @Test
    void createBookingRejectsVehicleOutsideCustomer() {
        User customer = TestFixtures.customer();
        Vehicle vehicle = TestFixtures.car(customer);
        Garage garage = TestFixtures.garage();
        ServicePackage servicePackage = mainPackage();
        BookingCreateRequest request = bookingRequest(garage, vehicle, servicePackage);
        when(userRepository.findById(customer.getId())).thenReturn(Optional.of(customer));
        when(vehicleRepository.findByIdAndCustomer_Id(vehicle.getId(), customer.getId())).thenReturn(Optional.empty());

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> bookingService.createBooking(request, customer.getId()));

        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
    }

    @Test
    void createBookingRejectsMissingPackage() {
        User customer = TestFixtures.customer();
        Vehicle vehicle = TestFixtures.car(customer);
        Garage garage = TestFixtures.garage();
        ServicePackage servicePackage = mainPackage();
        BookingCreateRequest request = bookingRequest(garage, vehicle, servicePackage);
        when(userRepository.findById(customer.getId())).thenReturn(Optional.of(customer));
        when(vehicleRepository.findByIdAndCustomer_Id(vehicle.getId(), customer.getId())).thenReturn(Optional.of(vehicle));
        when(servicePackageRepository.findById(servicePackage.getId())).thenReturn(Optional.empty());

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> bookingService.createBooking(request, customer.getId()));

        assertEquals(HttpStatus.NOT_FOUND, error.getStatusCode());
    }

    @Test
    void createBookingRejectsVehicleOverlap() {
        User customer = TestFixtures.customer();
        Vehicle vehicle = TestFixtures.car(customer);
        Garage garage = TestFixtures.garage();
        ServicePackage servicePackage = mainPackage();
        BookingCreateRequest request = bookingRequest(garage, vehicle, servicePackage);
        stubSuccessfulBookingCreate(customer, vehicle, garage, servicePackage);
        when(bookingRepository.countOverlappingBookingsByVehicle(eq(vehicle.getId()), any(), any())).thenReturn(1L);

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> bookingService.createBooking(request, customer.getId()));

        assertEquals(HttpStatus.CONFLICT, error.getStatusCode());
    }

    @Test
    void createBookingRejectsCustomerGarageOverlap() {
        User customer = TestFixtures.customer();
        Vehicle vehicle = TestFixtures.car(customer);
        Garage garage = TestFixtures.garage();
        ServicePackage servicePackage = mainPackage();
        BookingCreateRequest request = bookingRequest(garage, vehicle, servicePackage);
        stubSuccessfulBookingCreate(customer, vehicle, garage, servicePackage);
        when(bookingRepository.countOverlappingBookingsByCustomerAndGarage(
                eq(customer.getId()), eq(garage.getId()), any(), any())).thenReturn(1L);

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> bookingService.createBooking(request, customer.getId()));

        assertEquals(HttpStatus.CONFLICT, error.getStatusCode());
    }

    @Test
    void createBookingRejectsFullWashBayCapacity() {
        User customer = TestFixtures.customer();
        Vehicle vehicle = TestFixtures.car(customer);
        Garage garage = TestFixtures.garage();
        ServicePackage servicePackage = mainPackage();
        BookingCreateRequest request = bookingRequest(garage, vehicle, servicePackage);
        stubSuccessfulBookingCreate(customer, vehicle, garage, servicePackage);
        when(washBayRepository.countActiveByGarageAndVehicleType(garage.getId(), "CAR")).thenReturn(1L);
        when(bookingRepository.countOverlappingBookingsByGarageAndVehicleType(
                eq(garage.getId()), eq("CAR"), any(), any())).thenReturn(1L);

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> bookingService.createBooking(request, customer.getId()));

        assertEquals(HttpStatus.CONFLICT, error.getStatusCode());
    }

    @Test
    void createBookingRejectsCareStaffCapacity() {
        User customer = TestFixtures.customer();
        Vehicle vehicle = TestFixtures.car(customer);
        Garage garage = TestFixtures.garage();
        ServicePackage servicePackage = careStaffPackage();
        BookingCreateRequest request = bookingRequest(garage, vehicle, servicePackage);
        stubSuccessfulBookingCreate(customer, vehicle, garage, servicePackage);
        when(staffProfileRepository.countByGarageIdAndStaffTypeAndIsActiveTrue(
                garage.getId(), StaffType.VEHICLE_CARE_STAFF)).thenReturn(0L);

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> bookingService.createBooking(request, customer.getId()));

        assertEquals(HttpStatus.CONFLICT, error.getStatusCode());
    }

    @Test
    void createBookingAppliesAddOnPromotionAndPointRedemption() {
        User customer = TestFixtures.customer();
        Vehicle vehicle = TestFixtures.car(customer);
        Garage garage = TestFixtures.garage();
        ServicePackage servicePackage = mainPackage();
        ServicePackage addOn = addOnPackage();
        CustomerLoyalty loyalty = TestFixtures.loyalty(customer);
        BookingCreateRequest request = bookingRequest(garage, vehicle, servicePackage);
        request.setAddOnServicePackageIds(List.of(addOn.getId()));
        request.setPromotionCode("SAVE15");
        request.setUsedPoints(20);
        stubSuccessfulBookingCreate(customer, vehicle, garage, servicePackage, loyalty);
        when(servicePackageRepository.findById(addOn.getId())).thenReturn(Optional.of(addOn));
        when(promotionService.validatePromotion(eq(customer.getId()), any()))
                .thenReturn(PromotionValidateResponse.builder()
                        .valid(true)
                        .promotionId(8L)
                        .promotionCode("SAVE15")
                        .discountAmount(new BigDecimal("15000.00"))
                        .finalAmount(new BigDecimal("135000.00"))
                        .allowLoyaltyStack(true)
                        .maxLoyaltyPoints(50)
                        .build());
        Promotion promotion = promotion();
        when(promotionRepository.findById(8L)).thenReturn(Optional.of(promotion));

        BookingResponse response = bookingService.createBooking(request, customer.getId());

        assertEquals(List.of(addOn.getId()), response.getAddOnServicePackageIds());
        assertMoney("150000.00", response.getOriginalPrice());
        assertMoney("35000.00", response.getDiscountAmount());
        assertMoney("115000.00", response.getFinalPrice());
        assertEquals(80, loyalty.getAvailablePoints());
        assertEquals(20, loyalty.getRedeemedPoints());
        assertEquals(1, promotion.getUsedCount());
        verify(pointTransactionRepository).save(any(PointTransaction.class));
        verify(promotionUsageRepository).save(any(PromotionUsage.class));
        verify(bookingAddOnServicePackageRepository).save(any(BookingAddOnServicePackage.class));
    }

    @Test
    void createBookingAllowsComboAsMainPackage() {
        User customer = TestFixtures.customer();
        Vehicle vehicle = TestFixtures.car(customer);
        Garage garage = TestFixtures.garage();
        ServicePackage servicePackage = mainPackage();
        servicePackage.setServiceType("COMBO");
        BookingCreateRequest request = bookingRequest(garage, vehicle, servicePackage);
        stubSuccessfulBookingCreate(customer, vehicle, garage, servicePackage);

        BookingResponse response = bookingService.createBooking(request, customer.getId());

        assertEquals(servicePackage.getId(), response.getServicePackageId());
        assertEquals("CONFIRMED", response.getStatus());
    }

    @Test
    void createWalkInBookingCreatesGuestBooking() {
        User staffUser = TestFixtures.staff();
        Garage garage = TestFixtures.garage();
        ServicePackage servicePackage = mainPackage();
        StaffProfile staffProfile = TestFixtures.careStaff(staffUser, garage);
        WalkInBookingCreateRequest request = walkInRequest(garage, servicePackage);
        stubWalkInCreate(staffUser, staffProfile, garage, servicePackage);

        BookingResponse response = bookingService.createWalkInBooking(request, staffUser.getId());

        assertTrue(response.getIsWalkIn());
        assertEquals("51H12345", response.getLicensePlate());
        assertEquals(staffUser.getId(), response.getCreatedByStaffId());
        assertEquals("CONFIRMED", response.getStatus());
        verify(loyaltyService).updateBookingStatistics(10L);
    }

    @Test
    void createWalkInBookingRejectsStaffFromAnotherGarage() {
        User staffUser = TestFixtures.staff();
        Garage garage = TestFixtures.garage();
        Garage otherGarage = TestFixtures.garage();
        otherGarage.setId(2L);
        ServicePackage servicePackage = mainPackage();
        StaffProfile staffProfile = TestFixtures.careStaff(staffUser, garage);
        WalkInBookingCreateRequest request = walkInRequest(otherGarage, servicePackage);
        when(staffProfileRepository.findByUser_Id(staffUser.getId())).thenReturn(Optional.of(staffProfile));

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> bookingService.createWalkInBooking(request, staffUser.getId()));

        assertEquals(HttpStatus.FORBIDDEN, error.getStatusCode());
    }

    @Test
    void checkInBookingMovesConfirmedBookingToCheckedIn() {
        User staffUser = TestFixtures.staff();
        Garage garage = TestFixtures.garage();
        Vehicle vehicle = TestFixtures.car(TestFixtures.customer());
        Booking booking = confirmedBooking(vehicle, garage, mainPackage());
        StaffProfile staffProfile = TestFixtures.careStaff(staffUser, garage);
        when(staffProfileRepository.findByUser_Id(staffUser.getId())).thenReturn(Optional.of(staffProfile));
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(vehicleRepository.findById(vehicle.getId())).thenReturn(Optional.of(vehicle));

        BookingResponse response = bookingService.checkInBooking(booking.getId(), staffUser.getId(), "arrived");

        assertEquals("CHECKED_IN", response.getStatus());
        assertNotNull(response.getCheckedInAt());
        assertEquals("arrived", response.getNote());
    }

    @Test
    void startServiceAssignsWashBayCareStaffAndSteps() {
        User staffUser = TestFixtures.staff();
        Garage garage = TestFixtures.garage();
        Vehicle vehicle = TestFixtures.car(TestFixtures.customer());
        ServicePackage servicePackage = careStaffPackage();
        Booking booking = confirmedBooking(vehicle, garage, servicePackage);
        booking.setStatus("CHECKED_IN");
        StaffProfile staffProfile = TestFixtures.careStaff(staffUser, garage);
        WashBay washBay = TestFixtures.washBay(garage);
        ServicePackageStep template = serviceStep(servicePackage);
        when(staffProfileRepository.findByUser_Id(staffUser.getId())).thenReturn(Optional.of(staffProfile));
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(servicePackageRepository.findById(servicePackage.getId())).thenReturn(Optional.of(servicePackage));
        when(washBayRepository.findFirstByGarageIdAndVehicleTypeAndStatusAndIsActiveTrue(
                garage.getId(), "CAR", WashBayStatus.AVAILABLE)).thenReturn(Optional.of(washBay));
        when(washBayRepository.save(any(WashBay.class))).thenAnswer(invocation -> invocation.getArgument(0));
        when(staffProfileRepository.findByGarageIdAndStaffTypeAndIsActiveTrue(
                garage.getId(), StaffType.VEHICLE_CARE_STAFF)).thenReturn(List.of(staffProfile));
        when(bookingAssignedStaffRepository.countOverlap(staffProfile.getId(), booking.getStartTime(), booking.getEndTime()))
                .thenReturn(0L);
        when(comboStepResolver.resolveSteps(servicePackage)).thenReturn(List.of(template));
        when(bookingServiceStepRepository.save(any(BookingServiceStep.class))).thenAnswer(invocation -> {
            BookingServiceStep step = invocation.getArgument(0);
            step.setId(100L);
            return step;
        });
        when(vehicleRepository.findById(vehicle.getId())).thenReturn(Optional.of(vehicle));
        StartServiceRequest request = new StartServiceRequest();
        request.setNote("start now");

        BookingResponse response = bookingService.startService(booking.getId(), staffUser.getId(), request);

        assertEquals("IN_PROGRESS", response.getStatus());
        assertEquals(washBay.getId(), response.getWashBayId());
        assertNotNull(response.getWashBayStartTime());
        assertEquals(WashBayStatus.IN_USE, washBay.getStatus());
        assertEquals(booking.getId(), washBay.getCurrentBookingId());
        verify(bookingAssignedStaffRepository).save(any(BookingAssignedStaff.class));
        verify(bookingServiceStepRepository).save(any(BookingServiceStep.class));
    }

    @Test
    void completeServiceReleasesWashBayAndCareStaff() {
        User staffUser = TestFixtures.staff();
        Garage garage = TestFixtures.garage();
        Vehicle vehicle = TestFixtures.car(TestFixtures.customer());
        Booking booking = confirmedBooking(vehicle, garage, mainPackage());
        booking.setStatus("IN_PROGRESS");
        booking.setWashBayId(3L);
        booking.setWashBayStartTime(TestFixtures.BASE_TIME);
        StaffProfile staffProfile = TestFixtures.careStaff(staffUser, garage);
        WashBay washBay = TestFixtures.washBay(garage);
        washBay.setId(3L);
        washBay.setStatus(WashBayStatus.IN_USE);
        washBay.setCurrentBookingId(booking.getId());
        BookingAssignedStaff assignedStaff = assignedStaff(booking, staffProfile);
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(staffProfileRepository.findByUser_Id(staffUser.getId())).thenReturn(Optional.of(staffProfile));
        when(washBayRepository.findById(washBay.getId())).thenReturn(Optional.of(washBay));
        when(bookingAssignedStaffRepository.findByBookingId(booking.getId())).thenReturn(List.of(assignedStaff));
        when(vehicleRepository.findById(vehicle.getId())).thenReturn(Optional.of(vehicle));

        BookingResponse response = bookingService.completeService(booking.getId(), staffUser.getId(), "ROLE_STAFF", "done");

        assertEquals("COMPLETED", response.getStatus());
        assertNotNull(response.getCompletedAt());
        assertEquals(3L, response.getWashBayId());
        assertEquals(TestFixtures.BASE_TIME, response.getWashBayStartTime());
        assertNotNull(response.getWashBayEndTime());
        assertEquals(WashBayStatus.AVAILABLE, washBay.getStatus());
        assertNull(washBay.getCurrentBookingId());
        assertEquals("RELEASED", assignedStaff.getStatus());
    }

    @Test
    void completeServiceStepMarksStepCompletedByStaff() {
        User staffUser = TestFixtures.staff();
        Garage garage = TestFixtures.garage();
        Vehicle vehicle = TestFixtures.car(TestFixtures.customer());
        Booking booking = confirmedBooking(vehicle, garage, mainPackage());
        booking.setStatus("IN_PROGRESS");
        BookingServiceStep step = new BookingServiceStep();
        step.setId(100L);
        step.setBookingId(booking.getId());
        step.setServicePackageId(booking.getServicePackageId());
        step.setStepOrder(1);
        step.setName("Foam wash");
        step.setStatus("PENDING");
        StaffProfile staffProfile = TestFixtures.careStaff(staffUser, garage);
        when(bookingServiceStepRepository.findById(step.getId())).thenReturn(Optional.of(step));
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(staffProfileRepository.findByUser_Id(staffUser.getId())).thenReturn(Optional.of(staffProfile));
        when(bookingServiceStepRepository.save(any(BookingServiceStep.class))).thenAnswer(invocation -> invocation.getArgument(0));

        BookingServiceStepResponse response = bookingService.completeServiceStep(
                step.getId(), staffUser.getId(), new CompleteBookingServiceStepRequest());

        assertEquals("COMPLETED", response.getStatus());
        assertEquals(staffUser.getId(), response.getCompletedByStaffId());
        assertNotNull(response.getCompletedAt());
    }

    @Test
    void cancelBookingReleasesResourcesAndRefundsPoints() {
        User staffUser = TestFixtures.staff();
        Garage garage = TestFixtures.garage();
        Vehicle vehicle = TestFixtures.car(TestFixtures.customer());
        Booking booking = confirmedBooking(vehicle, garage, mainPackage());
        booking.setWashBayId(3L);
        StaffProfile staffProfile = TestFixtures.careStaff(staffUser, garage);
        WashBay washBay = TestFixtures.washBay(garage);
        washBay.setId(3L);
        washBay.setStatus(WashBayStatus.IN_USE);
        washBay.setCurrentBookingId(booking.getId());
        BookingAssignedStaff assignedStaff = assignedStaff(booking, staffProfile);
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(staffProfileRepository.findByUser_Id(staffUser.getId())).thenReturn(Optional.of(staffProfile));
        when(washBayRepository.findById(washBay.getId())).thenReturn(Optional.of(washBay));
        when(bookingAssignedStaffRepository.findByBookingId(booking.getId())).thenReturn(List.of(assignedStaff));
        when(vehicleRepository.findById(vehicle.getId())).thenReturn(Optional.of(vehicle));

        BookingResponse response = bookingService.cancelBooking(
                booking.getId(), staffUser.getId(), "ROLE_STAFF", "customer requested");

        assertEquals("CANCELED", response.getStatus());
        assertNull(response.getWashBayId());
        assertEquals(WashBayStatus.AVAILABLE, washBay.getStatus());
        assertEquals("RELEASED", assignedStaff.getStatus());
        verify(loyaltyService).refundPointsForCanceledBooking(booking.getId());
    }

    @Test
    void cancelBookingReleasesPromotionUsageAndDecrementsVoucherCount() {
        User staffUser = TestFixtures.staff();
        Garage garage = TestFixtures.garage();
        Vehicle vehicle = TestFixtures.car(TestFixtures.customer());
        Booking booking = confirmedBooking(vehicle, garage, mainPackage());
        booking.setPromotionId(8L);
        StaffProfile staffProfile = TestFixtures.careStaff(staffUser, garage);
        Promotion promotion = promotion();
        promotion.setUsedCount(2);
        PromotionUsage usage = new PromotionUsage();
        usage.setId(3L);
        usage.setPromotionId(promotion.getId());
        usage.setBookingId(booking.getId());
        usage.setCustomerId(booking.getCustomerId());
        usage.setDiscountAmount(new java.math.BigDecimal("15000.00"));
        usage.setUsedAt(TestFixtures.BASE_TIME);
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(staffProfileRepository.findByUser_Id(staffUser.getId())).thenReturn(Optional.of(staffProfile));
        when(bookingAssignedStaffRepository.findByBookingId(booking.getId())).thenReturn(List.of());
        when(promotionUsageRepository.findByBookingId(booking.getId())).thenReturn(Optional.of(usage));
        when(promotionRepository.findById(promotion.getId())).thenReturn(Optional.of(promotion));
        when(vehicleRepository.findById(vehicle.getId())).thenReturn(Optional.of(vehicle));

        BookingResponse response = bookingService.cancelBooking(
                booking.getId(), staffUser.getId(), "ROLE_STAFF", "changed plan");

        assertEquals("CANCELED", response.getStatus());
        assertEquals(1, promotion.getUsedCount());
        verify(promotionUsageRepository).delete(usage);
        verify(promotionRepository).save(promotion);
    }

    @Test
    void markNoShowReleasesResources() {
        User staffUser = TestFixtures.staff();
        Garage garage = TestFixtures.garage();
        Vehicle vehicle = TestFixtures.car(TestFixtures.customer());
        Booking booking = confirmedBooking(vehicle, garage, mainPackage());
        booking.setWashBayId(3L);
        StaffProfile staffProfile = TestFixtures.careStaff(staffUser, garage);
        WashBay washBay = TestFixtures.washBay(garage);
        washBay.setId(3L);
        washBay.setStatus(WashBayStatus.IN_USE);
        washBay.setCurrentBookingId(booking.getId());
        BookingAssignedStaff assignedStaff = assignedStaff(booking, staffProfile);
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(staffProfileRepository.findByUser_Id(staffUser.getId())).thenReturn(Optional.of(staffProfile));
        when(washBayRepository.findById(washBay.getId())).thenReturn(Optional.of(washBay));
        when(bookingAssignedStaffRepository.findByBookingId(booking.getId())).thenReturn(List.of(assignedStaff));
        when(vehicleRepository.findById(vehicle.getId())).thenReturn(Optional.of(vehicle));

        BookingResponse response = bookingService.markNoShow(booking.getId(), staffUser.getId(), "no arrival");

        assertEquals("NO_SHOW", response.getStatus());
        assertNull(response.getWashBayId());
        assertEquals(WashBayStatus.AVAILABLE, washBay.getStatus());
        assertNull(washBay.getCurrentBookingId());
        assertEquals("RELEASED", assignedStaff.getStatus());
    }

    @Test
    void markBookingPaidRejectsBookingThatIsNotCompleted() {
        User staffUser = TestFixtures.staff();
        Garage garage = TestFixtures.garage();
        Vehicle vehicle = TestFixtures.car(TestFixtures.customer());
        Booking booking = confirmedBooking(vehicle, garage, mainPackage());
        booking.setStatus("IN_PROGRESS");
        StaffProfile staffProfile = TestFixtures.careStaff(staffUser, garage);
        MarkBookingPaidRequest request = cashPaymentRequest();
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(staffProfileRepository.findByUser_Id(staffUser.getId())).thenReturn(Optional.of(staffProfile));

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> bookingService.markBookingPaid(booking.getId(), staffUser.getId(), "ROLE_STAFF", request));

        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
        verify(loyaltyService, never()).earnPointsAfterPaidBooking(anyLong());
        verify(washHistoryService, never()).createWashHistoryAfterPaidBooking(anyLong());
    }

    @Test
    void markBookingPaidAcceptsCompletedCashBookingAndRunsPostPaymentChain() {
        User staffUser = TestFixtures.staff();
        Garage garage = TestFixtures.garage();
        Vehicle vehicle = TestFixtures.car(TestFixtures.customer());
        Booking booking = confirmedBooking(vehicle, garage, mainPackage());
        booking.setStatus("COMPLETED");
        booking.setPaymentStatus("UNPAID");
        StaffProfile staffProfile = TestFixtures.careStaff(staffUser, garage);
        MarkBookingPaidRequest request = cashPaymentRequest();
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(staffProfileRepository.findByUser_Id(staffUser.getId())).thenReturn(Optional.of(staffProfile));
        when(vehicleRepository.findById(vehicle.getId())).thenReturn(Optional.of(vehicle));

        BookingResponse response = bookingService.markBookingPaid(
                booking.getId(), staffUser.getId(), "ROLE_STAFF", request);

        assertEquals("PAID", response.getPaymentStatus());
        assertEquals("CASH", response.getPaymentMethod());
        assertNotNull(response.getPaidAt());
        verify(loyaltyService).updateBookingStatistics(booking.getId());
        verify(promotionService).recordPromotionUsageAfterPaidBooking(booking.getId());
        verify(loyaltyService).earnPointsAfterPaidBooking(booking.getId());
        verify(washHistoryService).createWashHistoryAfterPaidBooking(booking.getId());
        verify(notificationService).notifyPaymentConfirmed(booking.getId());
        verify(notificationService).notifyRewardEarned(booking.getId());
    }

    @Test
    void markBookingPaidRejectsNonCashPaymentMethod() {
        User staffUser = TestFixtures.staff();
        Garage garage = TestFixtures.garage();
        Vehicle vehicle = TestFixtures.car(TestFixtures.customer());
        Booking booking = confirmedBooking(vehicle, garage, mainPackage());
        booking.setStatus("COMPLETED");
        StaffProfile staffProfile = TestFixtures.careStaff(staffUser, garage);
        MarkBookingPaidRequest request = cashPaymentRequest();
        request.setPaymentMethod("PAYOS");
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(staffProfileRepository.findByUser_Id(staffUser.getId())).thenReturn(Optional.of(staffProfile));

        ResponseStatusException error = assertThrows(ResponseStatusException.class,
                () -> bookingService.markBookingPaid(booking.getId(), staffUser.getId(), "ROLE_STAFF", request));

        assertEquals(HttpStatus.BAD_REQUEST, error.getStatusCode());
        verify(bookingRepository, never()).save(booking);
    }

    private void stubSuccessfulBookingCreate(
            User customer,
            Vehicle vehicle,
            Garage garage,
            ServicePackage servicePackage) {
        stubSuccessfulBookingCreate(customer, vehicle, garage, servicePackage, TestFixtures.loyalty(customer));
    }

    private void stubSuccessfulBookingCreate(
            User customer,
            Vehicle vehicle,
            Garage garage,
            ServicePackage servicePackage,
            CustomerLoyalty loyalty) {
        when(userRepository.findById(customer.getId())).thenReturn(Optional.of(customer));
        when(vehicleRepository.findByIdAndCustomer_Id(vehicle.getId(), customer.getId())).thenReturn(Optional.of(vehicle));
        when(vehicleRepository.findById(vehicle.getId())).thenReturn(Optional.of(vehicle));
        when(servicePackageRepository.findById(servicePackage.getId())).thenReturn(Optional.of(servicePackage));
        when(garageRepository.findById(garage.getId())).thenReturn(Optional.of(garage));
        when(washBayRepository.findDistinctVehicleTypesByGarageId(garage.getId())).thenReturn(List.of("CAR"));
        when(customerLoyaltyRepository.findByCustomerId(customer.getId())).thenReturn(Optional.of(loyalty));
        LoyaltyTierRule tierRule = TestFixtures.bronzeTierRule();
        tierRule.setBookingWindowDays(30);
        tierRule.setMaxUpcomingBookings(5);
        when(loyaltyTierRuleRepository.findByTierAndIsActiveTrue("BRONZE")).thenReturn(Optional.of(tierRule));
        when(bookingRepository.countUpcomingBookings(eq(customer.getId()), any())).thenReturn(0L);
        when(bookingRepository.countOverlappingBookingsByVehicle(eq(vehicle.getId()), any(), any())).thenReturn(0L);
        when(bookingRepository.countOverlappingBookingsByCustomerAndGarage(
                eq(customer.getId()), eq(garage.getId()), any(), any())).thenReturn(0L);
        when(washBayRepository.countActiveByGarageAndVehicleType(garage.getId(), "CAR")).thenReturn(2L);
        when(bookingRepository.countOverlappingBookingsByGarageAndVehicleType(
                eq(garage.getId()), eq("CAR"), any(), any())).thenReturn(0L);
        when(staffProfileRepository.countByGarageIdAndStaffTypeAndIsActiveTrue(
                garage.getId(), StaffType.VEHICLE_CARE_STAFF)).thenReturn(2L);
        when(bookingAssignedStaffRepository.countAssignedStaffByGarageAndTypeAndTime(
                eq(garage.getId()), eq(StaffType.VEHICLE_CARE_STAFF), any(), any())).thenReturn(0L);
    }

    private void stubWalkInCreate(
            User staffUser,
            StaffProfile staffProfile,
            Garage garage,
            ServicePackage servicePackage) {
        when(staffProfileRepository.findByUser_Id(staffUser.getId())).thenReturn(Optional.of(staffProfile));
        when(garageRepository.findById(garage.getId())).thenReturn(Optional.of(garage));
        when(servicePackageRepository.findById(servicePackage.getId())).thenReturn(Optional.of(servicePackage));
        when(washBayRepository.findDistinctVehicleTypesByGarageId(garage.getId())).thenReturn(List.of("CAR"));
        when(bookingRepository.countOverlappingBookingsByLicensePlate(eq("51H12345"), any(), any())).thenReturn(0L);
        when(washBayRepository.countActiveByGarageAndVehicleType(garage.getId(), "CAR")).thenReturn(2L);
        when(bookingRepository.countOverlappingBookingsByGarageAndVehicleType(
                eq(garage.getId()), eq("CAR"), any(), any())).thenReturn(0L);
        when(userRepository.findByPhone("0903000001")).thenReturn(Optional.empty());
    }

    private BookingCreateRequest bookingRequest(Garage garage, Vehicle vehicle, ServicePackage servicePackage) {
        BookingCreateRequest request = TestFixtures.bookingCreateRequest(garage, vehicle, servicePackage);
        request.setStartTime(slotStart());
        return request;
    }

    private WalkInBookingCreateRequest walkInRequest(Garage garage, ServicePackage servicePackage) {
        WalkInBookingCreateRequest request = new WalkInBookingCreateRequest();
        request.setGarageId(garage.getId());
        request.setGuestName("Nguyen Van Minh");
        request.setGuestPhone("0903000001");
        request.setLicensePlate("51H-123.45");
        request.setVehicleType("CAR");
        request.setSeatCount(5);
        request.setVehicleBrand("Toyota");
        request.setVehicleModel("Vios");
        request.setServicePackageId(servicePackage.getId());
        request.setStartTime(slotStart());
        request.setPaymentMethod("CASH");
        return request;
    }

    private Booking confirmedBooking(Vehicle vehicle, Garage garage, ServicePackage servicePackage) {
        Booking booking = TestFixtures.confirmedBooking(TestFixtures.customer(), vehicle, garage, servicePackage);
        booking.setId(20L);
        booking.setStartTime(slotStart());
        booking.setEndTime(slotStart().plusMinutes(servicePackage.getDurationMinutes()));
        booking.setBookingDate(slotStart().toLocalDate());
        return booking;
    }

    private ServicePackage mainPackage() {
        ServicePackage servicePackage = TestFixtures.carWashPackage();
        servicePackage.setRequiresCareStaff(false);
        servicePackage.setCareStaffType(null);
        servicePackage.setCareStaffRequiredCount(0);
        servicePackage.setCareStaffDurationMinutes(0);
        return servicePackage;
    }

    private ServicePackage careStaffPackage() {
        ServicePackage servicePackage = TestFixtures.carWashPackage();
        servicePackage.setRequiresCareStaff(true);
        servicePackage.setCareStaffType("VEHICLE_CARE_STAFF");
        servicePackage.setCareStaffRequiredCount(1);
        servicePackage.setCareStaffDurationMinutes(45);
        return servicePackage;
    }

    private ServicePackage addOnPackage() {
        return ServicePackage.builder()
                .id(2L)
                .name("Interior Vacuum")
                .code("CAR-VACUUM")
                .vehicleType("CAR")
                .serviceType("ADD_ON")
                .basePrice(new BigDecimal("30000.00"))
                .durationMinutes(20)
                .washBayDurationMinutes(0)
                .pointsEarned(5)
                .requiresWashBay(false)
                .requiresCareStaff(false)
                .careStaffRequiredCount(0)
                .careStaffDurationMinutes(0)
                .isActive(true)
                .seatCount(5)
                .build();
    }

    private ServicePackageStep serviceStep(ServicePackage servicePackage) {
        return ServicePackageStep.builder()
                .id(50L)
                .servicePackage(servicePackage)
                .stepOrder(1)
                .name("Foam wash")
                .description("Apply foam")
                .isRequired(true)
                .build();
    }

    private Promotion promotion() {
        Promotion promotion = new Promotion();
        promotion.setId(8L);
        promotion.setCode("SAVE15");
        promotion.setName("Save 15k");
        promotion.setDiscountType("FIXED_AMOUNT");
        promotion.setDiscountValue(new BigDecimal("15000.00"));
        promotion.setUsedCount(0);
        promotion.setStartAt(LocalDateTime.now().minusDays(1));
        promotion.setEndAt(LocalDateTime.now().plusDays(30));
        promotion.setIsActive(true);
        promotion.setAllowLoyaltyStack(true);
        return promotion;
    }

    private BookingAssignedStaff assignedStaff(Booking booking, StaffProfile staffProfile) {
        BookingAssignedStaff assignedStaff = new BookingAssignedStaff();
        assignedStaff.setId(1L);
        assignedStaff.setBookingId(booking.getId());
        assignedStaff.setStaffProfileId(staffProfile.getId());
        assignedStaff.setAssignedFrom(booking.getStartTime());
        assignedStaff.setAssignedTo(booking.getEndTime());
        assignedStaff.setRoleInBooking("VEHICLE_CARE_STAFF");
        assignedStaff.setStatus("ASSIGNED");
        return assignedStaff;
    }

    private MarkBookingPaidRequest cashPaymentRequest() {
        MarkBookingPaidRequest request = new MarkBookingPaidRequest();
        request.setPaymentMethod("CASH");
        request.setNote("paid by cash");
        return request;
    }

    private LocalDateTime slotStart() {
        return LocalDateTime.now().plusDays(2).withHour(9).withMinute(0).withSecond(0).withNano(0);
    }

    private void assertMoney(String expected, BigDecimal actual) {
        assertEquals(0, new BigDecimal(expected).compareTo(actual));
    }
}
