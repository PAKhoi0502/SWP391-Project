package com.autowashpro.service.impl;

import com.autowashpro.entity.User;
import com.autowashpro.repository.BookingRepository;
import com.autowashpro.repository.BookingServiceStepRepository;
import com.autowashpro.repository.CustomerLoyaltyRepository;
import com.autowashpro.repository.GarageRepository;
import com.autowashpro.repository.GarageServicePackageRepository;
import com.autowashpro.repository.LoyaltyTierRuleRepository;
import com.autowashpro.repository.ServicePackageRepository;
import com.autowashpro.repository.UserRepository;
import com.autowashpro.repository.VehicleRepository;
import com.autowashpro.repository.WashBayRepository;
import com.autowashpro.support.TestFixtures;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class BookingPhoneEligibilityTest {

    @Mock private UserRepository userRepository;
    @Mock private BookingRepository bookingRepository;
    @Mock private GarageRepository garageRepository;
    @Mock private ServicePackageRepository servicePackageRepository;
    @Mock private VehicleRepository vehicleRepository;
    @Mock private WashBayRepository washBayRepository;
    @Mock private CustomerLoyaltyRepository customerLoyaltyRepository;
    @Mock private LoyaltyTierRuleRepository loyaltyTierRuleRepository;
    @Mock private BookingServiceStepRepository bookingServiceStepRepository;
    @Mock private GarageServicePackageRepository garageServicePackageRepository;
    @Mock private com.autowashpro.repository.BookingAddOnServicePackageRepository bookingAddOnServicePackageRepository;
    @Mock private com.autowashpro.repository.PointTransactionRepository pointTransactionRepository;
    @Mock private com.autowashpro.repository.PaymentTransactionRepository paymentTransactionRepository;
    @Mock private com.autowashpro.repository.BookingAssignedStaffRepository bookingAssignedStaffRepository;
    @Mock private com.autowashpro.repository.StaffProfileRepository staffProfileRepository;
    @Mock private com.autowashpro.repository.ServicePackageStepRepository servicePackageStepRepository;
    @Mock private com.autowashpro.repository.VehicleInspectionRepository vehicleInspectionRepository;
    @Mock private com.autowashpro.repository.PromotionRepository promotionRepository;
    @Mock private com.autowashpro.repository.PromotionUsageRepository promotionUsageRepository;
    @Mock private ComboStepResolver comboStepResolver;
    @Mock private com.autowashpro.service.LoyaltyService loyaltyService;
    @Mock private com.autowashpro.service.LoyaltyPointExpiryService loyaltyPointExpiryService;
    @Mock private com.autowashpro.service.WashHistoryService washHistoryService;
    @Mock private com.autowashpro.service.PromotionService promotionService;
    @Mock private com.autowashpro.service.NotificationService notificationService;
    @Mock private com.autowashpro.service.EmailService emailService;
    @Mock private com.autowashpro.service.BookingReviewService bookingReviewService;
    @Mock private com.autowashpro.service.support.StaffOperationAccessPolicy staffOperationAccessPolicy;
    @Mock private com.autowashpro.service.support.PackageResourceResolver packageResourceResolver;

    @InjectMocks
    private BookingServiceImpl bookingService;

    // ── 1: invalid phone format → 400 ────────────────────────────────────────

    @Test
    void invalidPhoneFormat_throws400() {
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> bookingService.checkGuestPhoneEligibility("not-a-phone"));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
    }

    @Test
    void blankPhone_throws400() {
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> bookingService.checkGuestPhoneEligibility(""));
        assertEquals(HttpStatus.BAD_REQUEST, ex.getStatusCode());
    }

    // ── 2: phone not registered → 200 eligible (no exception) ───────────────

    @Test
    void unregisteredPhone_noException() {
        when(userRepository.findByPhone(any())).thenReturn(Optional.empty());
        assertDoesNotThrow(() -> bookingService.checkGuestPhoneEligibility("0901000099"));
    }

    // ── 3: phone belongs to active CUSTOMER → 409 ACCOUNT_EXISTS ────────────

    @Test
    void registeredActiveCustomer_throws409() {
        User customer = TestFixtures.customer();
        when(userRepository.findByPhone(customer.getPhone())).thenReturn(Optional.of(customer));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> bookingService.checkGuestPhoneEligibility("0901000001"));
        assertEquals(HttpStatus.CONFLICT, ex.getStatusCode());
        assertEquals("ACCOUNT_EXISTS_SIGN_IN_REQUIRED", ex.getReason());
    }

    // ── 4: inactive account → eligible (no exception) ───────────────────────

    @Test
    void inactiveAccount_treatedAsEligible() {
        User inactive = TestFixtures.customer();
        inactive.setIsActive(false);
        when(userRepository.findByPhone(any())).thenReturn(Optional.of(inactive));
        assertDoesNotThrow(() -> bookingService.checkGuestPhoneEligibility("0901000001"));
    }

    // ── 5: STAFF role phone → eligible (only CUSTOMER triggers 409) ─────────

    @Test
    void staffRolePhone_treatedAsEligible() {
        User staff = TestFixtures.staff();
        when(userRepository.findByPhone(any())).thenReturn(Optional.of(staff));
        assertDoesNotThrow(() -> bookingService.checkGuestPhoneEligibility("0901000002"));
    }

    // ── 6: endpoint writes nothing to DB ────────────────────────────────────

    @Test
    void eligibilityCheck_writesNothingToDb() {
        when(userRepository.findByPhone(any())).thenReturn(Optional.empty());

        bookingService.checkGuestPhoneEligibility("0901000099");

        verify(bookingRepository, never()).save(any());
        verify(vehicleRepository, never()).save(any());
    }
}
