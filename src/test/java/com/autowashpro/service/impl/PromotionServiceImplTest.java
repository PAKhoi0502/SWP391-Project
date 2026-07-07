package com.autowashpro.service.impl;

import com.autowashpro.dto.request.CreatePromotionRequest;
import com.autowashpro.dto.request.PromotionValidateRequest;
import com.autowashpro.dto.request.UpdatePromotionRequest;
import com.autowashpro.dto.response.PromotionResponse;
import com.autowashpro.dto.response.PromotionValidateResponse;
import com.autowashpro.entity.Booking;
import com.autowashpro.entity.CustomerLoyalty;
import com.autowashpro.entity.Promotion;
import com.autowashpro.entity.PromotionApplicableTier;
import com.autowashpro.entity.PromotionUsage;
import com.autowashpro.entity.ServicePackage;
import com.autowashpro.entity.User;
import com.autowashpro.entity.Vehicle;
import com.autowashpro.repository.BookingRepository;
import com.autowashpro.repository.CustomerLoyaltyRepository;
import com.autowashpro.repository.PromotionApplicableTierRepository;
import com.autowashpro.repository.PromotionRepository;
import com.autowashpro.repository.PromotionUsageRepository;
import com.autowashpro.repository.UserRepository;
import com.autowashpro.service.NotificationService;
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

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PromotionServiceImplTest {

    @Mock
    private PromotionRepository promotionRepository;

    @Mock
    private PromotionApplicableTierRepository promotionApplicableTierRepository;

    @Mock
    private CustomerLoyaltyRepository customerLoyaltyRepository;

    @Mock
    private PromotionUsageRepository promotionUsageRepository;

    @Mock
    private BookingRepository bookingRepository;

    @Mock
    private NotificationService notificationService;

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private PromotionServiceImpl promotionService;

    @BeforeEach
    void setUp() {
        when(promotionRepository.save(any(Promotion.class))).thenAnswer(invocation -> {
            Promotion promotion = invocation.getArgument(0);
            if (promotion.getId() == null) {
                promotion.setId(8L);
            }
            return promotion;
        });
        when(promotionApplicableTierRepository.findByPromotionId(anyLong())).thenReturn(List.of());
    }

    @Test
    void createPromotionPersistsDefaultsAndApplicableTiers() {
        CreatePromotionRequest request = promotionCreateRequest();
        request.setIsActive(null);
        request.setAllowLoyaltyStack(null);
        request.setApplicableTiers(List.of("SILVER", "GOLD"));
        ArgumentCaptor<PromotionApplicableTier> tierCaptor = ArgumentCaptor.forClass(PromotionApplicableTier.class);

        PromotionResponse response = promotionService.createPromotion(request);

        assertEquals(8L, response.getId());
        assertEquals("SUMMER20", response.getCode());
        assertTrue(response.getIsActive());
        assertEquals(false, response.getAllowLoyaltyStack());
        verify(promotionApplicableTierRepository).deleteByPromotionId(8L);
        verify(promotionApplicableTierRepository, times(2)).save(tierCaptor.capture());
        assertEquals("SILVER", tierCaptor.getAllValues().get(0).getTier());
        assertEquals("GOLD", tierCaptor.getAllValues().get(1).getTier());
    }

    @Test
    void createPromotionRejectsDuplicateCode() {
        CreatePromotionRequest request = promotionCreateRequest();
        when(promotionRepository.existsByCode(request.getCode())).thenReturn(true);

        RuntimeException error = assertThrows(RuntimeException.class,
                () -> promotionService.createPromotion(request));

        assertEquals("Promotion code already exists", error.getMessage());
        verify(promotionRepository, never()).save(any());
    }

    @Test
    void createPromotionRejectsInvalidDateRange() {
        CreatePromotionRequest request = promotionCreateRequest();
        request.setStartAt(TestFixtures.BASE_TIME.plusDays(2));
        request.setEndAt(TestFixtures.BASE_TIME.plusDays(2));

        RuntimeException error = assertThrows(RuntimeException.class,
                () -> promotionService.createPromotion(request));

        assertEquals("Promotion start time must be before end time", error.getMessage());
    }

    @Test
    void createPromotionRejectsPercentageAboveOneHundred() {
        CreatePromotionRequest request = promotionCreateRequest();
        request.setDiscountValue(new BigDecimal("101.00"));

        RuntimeException error = assertThrows(RuntimeException.class,
                () -> promotionService.createPromotion(request));

        assertEquals("Percentage discount cannot exceed 100", error.getMessage());
    }

    @Test
    void updatePromotionValidatesAndReplacesTiers() {
        Promotion promotion = activePercentPromotion();
        UpdatePromotionRequest request = promotionUpdateRequest();
        request.setApplicableTiers(List.of("GOLD"));
        when(promotionRepository.findById(promotion.getId())).thenReturn(Optional.of(promotion));
        ArgumentCaptor<PromotionApplicableTier> tierCaptor = ArgumentCaptor.forClass(PromotionApplicableTier.class);

        PromotionResponse response = promotionService.updatePromotion(promotion.getId(), request);

        assertEquals("Updated promo", response.getName());
        assertEquals(new BigDecimal("15.00"), promotion.getDiscountValue());
        assertEquals(true, promotion.getAllowLoyaltyStack());
        assertEquals(50, promotion.getMaxLoyaltyPoints());
        verify(promotionApplicableTierRepository).deleteByPromotionId(promotion.getId());
        verify(promotionApplicableTierRepository).flush();
        verify(promotionApplicableTierRepository).save(tierCaptor.capture());
        assertEquals("GOLD", tierCaptor.getValue().getTier());
    }

    @Test
    void validatePromotionRejectsInactivePromotion() {
        Promotion promotion = activePercentPromotion();
        promotion.setIsActive(false);
        when(promotionRepository.findByCodeAndIsActiveTrue(promotion.getCode())).thenReturn(Optional.of(promotion));

        RuntimeException error = assertThrows(RuntimeException.class,
                () -> promotionService.validatePromotion(1L, validateRequest(promotion.getCode(), "200000.00")));

        assertEquals("Promotion is inactive", error.getMessage());
    }

    @Test
    void validatePromotionRejectsNotStartedPromotion() {
        Promotion promotion = activePercentPromotion();
        promotion.setStartAt(LocalDateTime.now().plusDays(1));
        promotion.setEndAt(LocalDateTime.now().plusDays(3));
        when(promotionRepository.findByCodeAndIsActiveTrue(promotion.getCode())).thenReturn(Optional.of(promotion));

        RuntimeException error = assertThrows(RuntimeException.class,
                () -> promotionService.validatePromotion(1L, validateRequest(promotion.getCode(), "200000.00")));

        assertEquals("Promotion has not started", error.getMessage());
    }

    @Test
    void validatePromotionRejectsExpiredPromotion() {
        Promotion promotion = activePercentPromotion();
        promotion.setStartAt(LocalDateTime.now().minusDays(3));
        promotion.setEndAt(LocalDateTime.now().minusDays(1));
        when(promotionRepository.findByCodeAndIsActiveTrue(promotion.getCode())).thenReturn(Optional.of(promotion));

        RuntimeException error = assertThrows(RuntimeException.class,
                () -> promotionService.validatePromotion(1L, validateRequest(promotion.getCode(), "200000.00")));

        assertEquals("Promotion has expired", error.getMessage());
    }

    @Test
    void validatePromotionRejectsUsageLimit() {
        Promotion promotion = activePercentPromotion();
        promotion.setUsageLimit(3);
        promotion.setUsedCount(3);
        when(promotionRepository.findByCodeAndIsActiveTrue(promotion.getCode())).thenReturn(Optional.of(promotion));

        RuntimeException error = assertThrows(RuntimeException.class,
                () -> promotionService.validatePromotion(1L, validateRequest(promotion.getCode(), "200000.00")));

        assertEquals("Promotion usage limit reached", error.getMessage());
    }

    @Test
    void validatePromotionRejectsPerUserLimitFromUsageAndPendingBookings() {
        Promotion promotion = activePercentPromotion();
        promotion.setPerUserLimit(2);
        when(promotionRepository.findByCodeAndIsActiveTrue(promotion.getCode())).thenReturn(Optional.of(promotion));
        when(promotionUsageRepository.countByPromotionIdAndCustomerId(promotion.getId(), 5L)).thenReturn(1L);
        when(bookingRepository.countByPromotionIdAndCustomerIdAndStatusNot(promotion.getId(), 5L, "CANCELED"))
                .thenReturn(1L);

        RuntimeException error = assertThrows(RuntimeException.class,
                () -> promotionService.validatePromotion(5L, validateRequest(promotion.getCode(), "200000.00")));

        assertEquals("Promotion per-user limit reached", error.getMessage());
    }

    @Test
    void validatePromotionRejectsIneligibleTier() {
        Promotion promotion = activePercentPromotion();
        CustomerLoyalty loyalty = TestFixtures.loyalty(TestFixtures.customer());
        loyalty.setCurrentTier("BRONZE");
        PromotionApplicableTier tier = new PromotionApplicableTier();
        tier.setPromotionId(promotion.getId());
        tier.setTier("GOLD");
        when(promotionRepository.findByCodeAndIsActiveTrue(promotion.getCode())).thenReturn(Optional.of(promotion));
        when(promotionApplicableTierRepository.findByPromotionId(promotion.getId())).thenReturn(List.of(tier));
        when(customerLoyaltyRepository.findByCustomerId(1L)).thenReturn(Optional.of(loyalty));

        RuntimeException error = assertThrows(RuntimeException.class,
                () -> promotionService.validatePromotion(1L, validateRequest(promotion.getCode(), "200000.00")));

        assertEquals("Your tier is not eligible", error.getMessage());
    }

    @Test
    void validatePromotionCalculatesPercentDiscountWithMaximumCap() {
        Promotion promotion = activePercentPromotion();
        promotion.setDiscountValue(new BigDecimal("50.00"));
        promotion.setMaxDiscountAmount(new BigDecimal("40000.00"));
        when(promotionRepository.findByCodeAndIsActiveTrue(promotion.getCode())).thenReturn(Optional.of(promotion));

        PromotionValidateResponse response = promotionService.validatePromotion(
                1L, validateRequest(promotion.getCode(), "120000.00"));

        assertMoney("40000.00", response.getDiscountAmount());
        assertMoney("80000.00", response.getFinalAmount());
        assertEquals(true, response.getAllowLoyaltyStack());
        assertEquals(100, response.getMaxLoyaltyPoints());
    }

    @Test
    void validatePromotionCapsFixedDiscountAtOrderAmount() {
        Promotion promotion = activeFixedPromotion();
        promotion.setDiscountValue(new BigDecimal("200000.00"));
        when(promotionRepository.findByCodeAndIsActiveTrue(promotion.getCode())).thenReturn(Optional.of(promotion));

        PromotionValidateResponse response = promotionService.validatePromotion(
                1L, validateRequest(promotion.getCode(), "120000.00"));

        assertMoney("120000.00", response.getDiscountAmount());
        assertMoney("0.00", response.getFinalAmount());
    }

    @Test
    void validatePromotionRejectsMinimumOrderAmount() {
        Promotion promotion = activePercentPromotion();
        promotion.setMinOrderAmount(new BigDecimal("150000.00"));
        when(promotionRepository.findByCodeAndIsActiveTrue(promotion.getCode())).thenReturn(Optional.of(promotion));

        RuntimeException error = assertThrows(RuntimeException.class,
                () -> promotionService.validatePromotion(1L, validateRequest(promotion.getCode(), "120000.00")));

        assertEquals("Order amount does not meet minimum requirement", error.getMessage());
    }

    @Test
    void recordPromotionUsageAfterPaidBookingCreatesUsageOnce() {
        Promotion promotion = activePercentPromotion();
        Booking booking = paidBookingWithPromotion(promotion);
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(promotionUsageRepository.existsByBookingId(booking.getId())).thenReturn(false);
        when(promotionRepository.findById(promotion.getId())).thenReturn(Optional.of(promotion));
        ArgumentCaptor<PromotionUsage> usageCaptor = ArgumentCaptor.forClass(PromotionUsage.class);

        promotionService.recordPromotionUsageAfterPaidBooking(booking.getId());

        verify(promotionUsageRepository).save(usageCaptor.capture());
        PromotionUsage usage = usageCaptor.getValue();
        assertEquals(promotion.getId(), usage.getPromotionId());
        assertEquals(booking.getId(), usage.getBookingId());
        assertEquals(booking.getCustomerId(), usage.getCustomerId());
        assertMoney("20000.00", usage.getDiscountAmount());
        assertEquals(1, promotion.getUsedCount());
        verify(promotionRepository).save(promotion);
    }

    @Test
    void recordPromotionUsageAfterPaidBookingIsIdempotent() {
        Promotion promotion = activePercentPromotion();
        Booking booking = paidBookingWithPromotion(promotion);
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(promotionUsageRepository.existsByBookingId(booking.getId())).thenReturn(true);

        promotionService.recordPromotionUsageAfterPaidBooking(booking.getId());

        verify(promotionUsageRepository, never()).save(any());
        verify(promotionRepository, never()).save(any());
    }

    @Test
    void recordPromotionUsageAfterPaidBookingSkipsUnpaidOrNoPromotionBooking() {
        Booking booking = paidBookingWithPromotion(activePercentPromotion());
        booking.setPaymentStatus("UNPAID");
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));

        promotionService.recordPromotionUsageAfterPaidBooking(booking.getId());

        verify(promotionUsageRepository, never()).save(any());
        verify(promotionRepository, never()).save(any());
    }

    private CreatePromotionRequest promotionCreateRequest() {
        CreatePromotionRequest request = new CreatePromotionRequest();
        request.setCode("SUMMER20");
        request.setName("Summer 20");
        request.setDescription("Summer promotion");
        request.setDiscountType("PERCENTAGE");
        request.setDiscountValue(new BigDecimal("20.00"));
        request.setMaxDiscountAmount(new BigDecimal("50000.00"));
        request.setMinOrderAmount(new BigDecimal("100000.00"));
        request.setUsageLimit(100);
        request.setPerUserLimit(2);
        request.setStartAt(LocalDateTime.now().minusDays(1));
        request.setEndAt(LocalDateTime.now().plusDays(10));
        request.setIsActive(true);
        request.setAllowLoyaltyStack(true);
        request.setMaxLoyaltyPoints(100);
        request.setApplicableTiers(List.of());
        return request;
    }

    private UpdatePromotionRequest promotionUpdateRequest() {
        UpdatePromotionRequest request = new UpdatePromotionRequest();
        request.setName("Updated promo");
        request.setDescription("Updated");
        request.setDiscountType("PERCENTAGE");
        request.setDiscountValue(new BigDecimal("15.00"));
        request.setMaxDiscountAmount(new BigDecimal("30000.00"));
        request.setMinOrderAmount(new BigDecimal("80000.00"));
        request.setUsageLimit(10);
        request.setPerUserLimit(1);
        request.setStartAt(LocalDateTime.now().minusDays(1));
        request.setEndAt(LocalDateTime.now().plusDays(5));
        request.setAllowLoyaltyStack(true);
        request.setMaxLoyaltyPoints(50);
        return request;
    }

    private PromotionValidateRequest validateRequest(String code, String orderAmount) {
        PromotionValidateRequest request = new PromotionValidateRequest();
        request.setPromotionCode(code);
        request.setServicePackageId(1L);
        request.setOrderAmount(new BigDecimal(orderAmount));
        return request;
    }

    private Promotion activePercentPromotion() {
        Promotion promotion = new Promotion();
        promotion.setId(8L);
        promotion.setCode("SAVE20");
        promotion.setName("Save 20");
        promotion.setDiscountType("PERCENTAGE");
        promotion.setDiscountValue(new BigDecimal("20.00"));
        promotion.setMaxDiscountAmount(null);
        promotion.setMinOrderAmount(null);
        promotion.setUsageLimit(null);
        promotion.setPerUserLimit(null);
        promotion.setUsedCount(0);
        promotion.setStartAt(LocalDateTime.now().minusDays(1));
        promotion.setEndAt(LocalDateTime.now().plusDays(10));
        promotion.setIsActive(true);
        promotion.setAllowLoyaltyStack(true);
        promotion.setMaxLoyaltyPoints(100);
        return promotion;
    }

    private Promotion activeFixedPromotion() {
        Promotion promotion = activePercentPromotion();
        promotion.setCode("FIXED50");
        promotion.setDiscountType("FIXED_AMOUNT");
        promotion.setDiscountValue(new BigDecimal("50000.00"));
        return promotion;
    }

    private Booking paidBookingWithPromotion(Promotion promotion) {
        User customer = TestFixtures.customer();
        Vehicle vehicle = TestFixtures.car(customer);
        ServicePackage servicePackage = TestFixtures.carWashPackage();
        Booking booking = TestFixtures.confirmedBooking(customer, vehicle, TestFixtures.garage(), servicePackage);
        booking.setId(20L);
        booking.setStatus("COMPLETED");
        booking.setPaymentStatus("PAID");
        booking.setPromotionId(promotion.getId());
        booking.setPromotionDiscountAmount(new BigDecimal("20000.00"));
        return booking;
    }

    private void assertMoney(String expected, BigDecimal actual) {
        assertEquals(0, new BigDecimal(expected).compareTo(actual));
    }
}
