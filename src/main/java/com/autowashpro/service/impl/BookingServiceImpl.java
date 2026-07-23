package com.autowashpro.service.impl;

import com.autowashpro.service.WashHistoryService;
import com.autowashpro.entity.enums.StaffType;
import com.autowashpro.dto.request.BookingCreateRequest;
import com.autowashpro.dto.request.CareAssignmentRequest;
import com.autowashpro.dto.request.CompleteBookingServiceStepRequest;
import com.autowashpro.dto.request.MarkBookingPaidRequest;
import com.autowashpro.dto.request.OperationPhaseRequest;
import com.autowashpro.dto.request.UpdatePaymentMethodRequest;
import com.autowashpro.dto.request.PromotionValidateRequest;
import com.autowashpro.dto.request.ReopenBookingServiceStepRequest;
import com.autowashpro.dto.request.StartServiceRequest;
import com.autowashpro.dto.request.WalkInBookingCreateRequest;
import com.autowashpro.dto.response.AssignedCareStaffResponse;
import com.autowashpro.dto.response.AvailableCareStaffResponse;
import com.autowashpro.dto.response.AvailableSlotResponse;
import com.autowashpro.dto.response.BookingResponse;
import com.autowashpro.dto.response.BookingServiceStepResponse;
import com.autowashpro.dto.response.CancellationPreviewResponse;
import com.autowashpro.dto.response.CareAssignmentStatusResponse;
import com.autowashpro.dto.response.CareTaskResponse;
import com.autowashpro.dto.response.SlotResponse;
import com.autowashpro.dto.response.WalkInCustomerLookupResponse;
import com.autowashpro.entity.*;
import com.autowashpro.entity.enums.WashBayStatus;
import com.autowashpro.repository.*;
import com.autowashpro.service.BookingService;
import com.autowashpro.service.LoyaltyService;
import com.autowashpro.service.LoyaltyPointExpiryService;
import com.autowashpro.service.PromotionService;
import com.autowashpro.service.EmailService;
import com.autowashpro.service.support.VietnameseLicensePlate;
import com.autowashpro.service.support.VietnamesePhoneNumber;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import com.autowashpro.dto.response.BookingSummaryResponse;
import com.autowashpro.dto.response.PromotionValidateResponse;
import com.autowashpro.dto.response.StaffBookingSummaryResponse;
import com.autowashpro.dto.response.StaffCalendarDayResponse;
import com.autowashpro.service.NotificationService;
import com.autowashpro.service.BookingReviewService;
import com.autowashpro.service.support.PackageResourceResolver;
import com.autowashpro.service.support.StaffOperationAccessPolicy;

import java.util.LinkedHashMap;

import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.HashMap;

@Slf4j
@Service
@RequiredArgsConstructor
public class BookingServiceImpl implements BookingService {

        private static final String ASSIGNED_STAFF_STATUS = "ASSIGNED";
        // ===================== ISSUE #54 =====================

        private static final BigDecimal DEPOSIT_PERCENT = BigDecimal.valueOf(0.30);

        private static final BigDecimal REFUND_PERCENT_100 = BigDecimal.ONE;
        private static final BigDecimal REFUND_PERCENT_80 = BigDecimal.valueOf(0.80);
        private static final BigDecimal REFUND_PERCENT_50 = BigDecimal.valueOf(0.50);
        private static final BigDecimal REFUND_PERCENT_0 = BigDecimal.ZERO;

        private static final long PAYMENT_TIMEOUT_MINUTES = 15L;
        private static final long GRACE_PERIOD_MINUTES = 30L;

        private static final long GRACE_MIN_HOURS_BEFORE_SERVICE = 2L;

        private static final long REFUND_RULE_24_HOURS = 24L;
        private static final long REFUND_RULE_12_HOURS = 12L;
        private static final long REFUND_RULE_6_HOURS = 6L;

        private final GarageRepository garageRepository;
        private final ServicePackageRepository servicePackageRepository;
        private final WashBayRepository washBayRepository;
        private final BookingRepository bookingRepository;
        private final PaymentTransactionRepository paymentTransactionRepository;
        private final VehicleRepository vehicleRepository;
        private final CustomerLoyaltyRepository customerLoyaltyRepository;
        private final LoyaltyTierRuleRepository loyaltyTierRuleRepository;
        private final PromotionRepository promotionRepository;
        private final PromotionUsageRepository promotionUsageRepository;
        private final BookingAssignedStaffRepository bookingAssignedStaffRepository;
        private final StaffProfileRepository staffProfileRepository;
        private final UserRepository userRepository;
        private final BookingServiceStepRepository bookingServiceStepRepository;
        private final ServicePackageStepRepository servicePackageStepRepository;
        private final VehicleInspectionRepository vehicleInspectionRepository;
        private final ComboStepResolver comboStepResolver;
        private final PackageResourceResolver packageResourceResolver;
        private final BookingAddOnServicePackageRepository bookingAddOnServicePackageRepository;
        private final PointTransactionRepository pointTransactionRepository;
        private final LoyaltyService loyaltyService;
        private final LoyaltyPointExpiryService loyaltyPointExpiryService;
        private final WashHistoryService washHistoryService;
        private final PromotionService promotionService;
        private final NotificationService notificationService;
        private final EmailService emailService;
        private final BookingReviewService bookingReviewService;
        private final StaffOperationAccessPolicy staffOperationAccessPolicy;

        // ===================== ISSUE #10 =====================

        @Override
        public AvailableSlotResponse getAvailableSlots(
                        Long garageId,
                        Long servicePackageId,
                        String vehicleType,
                        LocalDate date,
                        boolean isWalkIn,
                        List<Long> addOnServicePackageIds) {

                Garage garage = garageRepository.findById(garageId)
                                .orElseThrow(() -> new RuntimeException("Garage not found"));

                ServicePackage servicePackage = servicePackageRepository.findById(servicePackageId)
                                .orElseThrow(() -> new RuntimeException("Service package not found"));

                if (!isVehicleTypeCompatible(
                                vehicleType,
                                servicePackage)) {

                        throw new RuntimeException(
                                        "Service package does not support vehicle type: "
                                                        + vehicleType);
                }

                List<String> supportedVehicleTypes = washBayRepository.findDistinctVehicleTypesByGarageId(garageId);

                String bayType = resolveGarageBayType(supportedVehicleTypes, vehicleType);

                if (bayType == null) {
                        throw new RuntimeException("Garage does not support vehicle type: " + vehicleType);
                }

                // Load add-on packages for the slot calculation
                List<ServicePackage> addOns = new ArrayList<>();
                if (addOnServicePackageIds != null) {
                        for (Long addOnId : new java.util.LinkedHashSet<>(addOnServicePackageIds)) {
                                if (addOnId == null || addOnId.equals(servicePackageId)) continue;
                                servicePackageRepository.findById(addOnId).ifPresent(addOns::add);
                        }
                }
                List<ServicePackage> allPackages = buildSelectedPackages(servicePackage, addOns);

                // Compute resource windows for this package combination
                ResourceWindows rw = computeResourceWindows(allPackages);

                List<SlotResponse> slots = new ArrayList<>();

                // Rule 1: online booking phải đặt trước ít nhất 1 ngày.
                // Rule 2: walk-in được phép đặt trong ngày nếu còn slot trống.
                if (!isWalkIn && date.isBefore(LocalDate.now().plusDays(1))) {
                        return AvailableSlotResponse.builder()
                                        .garageId(garageId)
                                        .servicePackageId(servicePackageId)
                                        .date(date)
                                        .slots(slots)
                                        .build();
                }

                LocalTime current = garage.getOpeningTime();
                LocalDateTime now = LocalDateTime.now();
                int slotDurationMinutes = resolveSlotDurationMinutes(allPackages, garage);

                while (current.plusMinutes(slotDurationMinutes).isBefore(garage.getClosingTime())
                                || current.plusMinutes(slotDurationMinutes)
                                                .equals(garage.getClosingTime())) {

                        LocalDateTime start = LocalDateTime.of(date, current);
                        LocalDateTime end = start.plusMinutes(slotDurationMinutes);

                        if (!start.isAfter(now)) {
                                current = current.plusMinutes(garage.getSlotIntervalMinutes());
                                continue;
                        }

                        // Wash window starts at slot start
                        LocalDateTime washStart = rw.requiresWashBay ? start : null;
                        LocalDateTime washEnd = rw.requiresWashBay ? start.plusMinutes(rw.totalWashMinutes) : null;
                        // Care window starts right after wash window
                        LocalDateTime careStart = rw.requiresCareStaff
                                        ? (washEnd != null ? washEnd : start)
                                        : null;
                        LocalDateTime careEnd = rw.requiresCareStaff
                                        ? (careStart != null ? careStart.plusMinutes(rw.totalCareMinutes) : null)
                                        : null;

                        boolean bayOk = !rw.requiresWashBay
                                        || isWashBayAvailable(garageId, vehicleType, start, washEnd != null ? washEnd : end);
                        boolean staffOk = !rw.requiresCareStaff
                                        || isCareStaffAvailableForPackages(garageId, allPackages,
                                                        careStart != null ? careStart : start,
                                                        careEnd != null ? careEnd : end);
                        boolean available = bayOk && staffOk;

                        String fullReason = null;
                        if (!available) {
                                fullReason = !bayOk ? "NO_WASH_BAY" : "NO_CARE_STAFF";
                        }

                        slots.add(
                                        SlotResponse.builder()
                                                        .startTime(start)
                                                        .endTime(end)
                                                        .available(available)
                                                        .fullReason(fullReason)
                                                        .washStartAt(washStart)
                                                        .washEndAt(washEnd)
                                                        .careStartAt(careStart)
                                                        .careEndAt(careEnd)
                                                        .build());

                        current = current.plusMinutes(garage.getSlotIntervalMinutes());
                }

                return AvailableSlotResponse.builder()
                                .garageId(garageId)
                                .servicePackageId(servicePackageId)
                                .date(date)
                                .slots(slots)
                                .build();
        }

        /** Computed resource windows for a set of packages. */
        private static class ResourceWindows {
                boolean requiresWashBay;
                boolean requiresCareStaff;
                int totalWashMinutes;
                int totalCareMinutes;
                int requiredCareStaffCount;
                String careStaffType;
        }

        /** Compute resource windows (wash duration, care duration, staffing requirements) for a set of packages. */
        private ResourceWindows computeResourceWindows(List<ServicePackage> packages) {
                ResourceWindows rw = new ResourceWindows();
                for (ServicePackage pkg : packages) {
                        if (Boolean.TRUE.equals(pkg.getRequiresWashBay())) {
                                rw.requiresWashBay = true;
                                rw.totalWashMinutes += pkg.getWashBayDurationMinutes() != null
                                                ? pkg.getWashBayDurationMinutes() : 0;
                        }
                        if (Boolean.TRUE.equals(pkg.getRequiresCareStaff())) {
                                rw.requiresCareStaff = true;
                                rw.totalCareMinutes += pkg.getCareStaffDurationMinutes() != null
                                                ? pkg.getCareStaffDurationMinutes() : 0;
                                // requiredCareStaffCount is max across packages, not sum
                                int count = pkg.getCareStaffRequiredCount() != null ? pkg.getCareStaffRequiredCount() : 0;
                                if (count > rw.requiredCareStaffCount) rw.requiredCareStaffCount = count;
                                if (pkg.getCareStaffType() != null && !pkg.getCareStaffType().isBlank()) {
                                        rw.careStaffType = pkg.getCareStaffType();
                                }
                        }
                }
                return rw;
        }

        /** Check care staff availability for a list of packages over the given window. */
        private boolean isCareStaffAvailableForPackages(
                        Long garageId,
                        List<ServicePackage> packages,
                        LocalDateTime start,
                        LocalDateTime end) {

                ResourceWindows rw = computeResourceWindows(packages);
                if (!rw.requiresCareStaff || rw.requiredCareStaffCount <= 0) {
                        return true;
                }
                StaffType staffType = StaffType.valueOf(rw.careStaffType);
                long totalStaff = staffProfileRepository.countByGarageIdAndStaffTypeAndIsActiveTrue(garageId, staffType);
                long assigned = bookingAssignedStaffRepository.countAssignedStaffByGarageAndTypeAndTime(
                                garageId, staffType, start, end);
                return (totalStaff - assigned) >= rw.requiredCareStaffCount;
        }

        private int resolveSlotDurationMinutes(ServicePackage servicePackage, Garage garage) {
                int packageDuration = servicePackage.getDurationMinutes() != null
                                ? servicePackage.getDurationMinutes()
                                : 0;
                int garageInterval = garage.getSlotIntervalMinutes() != null
                                ? garage.getSlotIntervalMinutes()
                                : 0;

                return Math.max(packageDuration, garageInterval);
        }

        private int resolveSlotDurationMinutes(List<ServicePackage> servicePackages, Garage garage) {
                int totalDuration = servicePackages.stream()
                                .map(ServicePackage::getDurationMinutes)
                                .filter(Objects::nonNull)
                                .mapToInt(Integer::intValue)
                                .sum();
                int garageInterval = garage.getSlotIntervalMinutes() != null
                                ? garage.getSlotIntervalMinutes()
                                : 0;

                return Math.max(totalDuration, garageInterval);
        }

        private List<ServicePackage> buildSelectedPackages(ServicePackage mainPackage, List<ServicePackage> addOns) {
                // Expand COMBO packages into their constituent leaf packages so that resource
                // requirements of included sub-packages are included in slot / window calculations.
                LinkedHashMap<Long, ServicePackage> dedupMap = new LinkedHashMap<>();
                for (ServicePackage p : packageResourceResolver.resolveEffectivePackages(mainPackage)) {
                        dedupMap.put(p.getId(), p);
                }
                for (ServicePackage addOn : addOns) {
                        for (ServicePackage p : packageResourceResolver.resolveEffectivePackages(addOn)) {
                                dedupMap.putIfAbsent(p.getId(), p);
                        }
                }
                return new ArrayList<>(dedupMap.values());
        }

        private List<ServicePackage> loadAddOnPackages(List<Long> addOnIds, Long mainPackageId, Vehicle vehicle) {
                if (addOnIds == null || addOnIds.isEmpty()) {
                        return List.of();
                }

                List<ServicePackage> addOns = new ArrayList<>();
                for (Long addOnId : new LinkedHashSet<>(addOnIds)) {
                        if (addOnId == null || addOnId.equals(mainPackageId)) {
                                continue;
                        }

                        ServicePackage addOn = servicePackageRepository.findById(addOnId)
                                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                                                        "Add-on service package not found: " + addOnId));

                        if (!Boolean.TRUE.equals(addOn.getIsActive())) {
                                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                                                "Add-on service package is inactive: " + addOnId);
                        }

                        String serviceType = normalizeServiceType(addOn.getServiceType());
                        if (!"ADD_ON".equals(serviceType)) {
                                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                                                "Only ADD_ON service packages can be selected as add-ons");
                        }

                        if (!isVehicleTypeCompatible(vehicle, addOn)) {
                                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                                                "Vehicle is not compatible with selected add-on service package: "
                                                                + addOnId);
                        }

                        addOns.add(addOn);
                }

                return addOns;
        }

        private List<ServicePackage> loadWalkInAddOnPackages(List<Long> addOnIds, Long mainPackageId,
                        WalkInBookingCreateRequest request) {
                if (addOnIds == null || addOnIds.isEmpty()) {
                        return List.of();
                }

                List<ServicePackage> addOns = new ArrayList<>();
                for (Long addOnId : new LinkedHashSet<>(addOnIds)) {
                        if (addOnId == null || addOnId.equals(mainPackageId)) {
                                continue;
                        }

                        ServicePackage addOn = servicePackageRepository.findById(addOnId)
                                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                                                        "Add-on service package not found: " + addOnId));

                        if (!Boolean.TRUE.equals(addOn.getIsActive())) {
                                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                                                "Add-on service package is inactive: " + addOnId);
                        }

                        String serviceType = normalizeServiceType(addOn.getServiceType());
                        if (!"ADD_ON".equals(serviceType)) {
                                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                                                "Only ADD_ON service packages can be selected as add-ons");
                        }

                        if (!isWalkInVehicleCompatible(request, addOn)) {
                                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                                                "Vehicle is not compatible with selected add-on service package: "
                                                                + addOnId);
                        }

                        addOns.add(addOn);
                }

                return addOns;
        }

        private String normalizeServiceType(String serviceType) {
                String value = serviceType == null ? "" : serviceType.trim().toUpperCase();
                if ("ADDON".equals(value)) {
                        return "ADD_ON";
                }
                return value;
        }

        private BigDecimal sumBasePrice(List<ServicePackage> servicePackages) {
                return servicePackages.stream()
                                .map(ServicePackage::getBasePrice)
                                .filter(Objects::nonNull)
                                .reduce(BigDecimal.ZERO, BigDecimal::add);
        }

        private void validateCareStaffAvailability(Long garageId, List<ServicePackage> servicePackages,
                        LocalDateTime startTime, LocalDateTime endTime) {
                Map<StaffType, Integer> requiredByType = new HashMap<>();

                for (ServicePackage servicePackage : servicePackages) {
                        if (!Boolean.TRUE.equals(servicePackage.getRequiresCareStaff())
                                        || servicePackage.getCareStaffRequiredCount() == null
                                        || servicePackage.getCareStaffRequiredCount() <= 0) {
                                continue;
                        }

                        StaffType staffType = StaffType.valueOf(servicePackage.getCareStaffType());
                        requiredByType.merge(staffType, servicePackage.getCareStaffRequiredCount(), Integer::sum);
                }

                for (Map.Entry<StaffType, Integer> entry : requiredByType.entrySet()) {
                        long totalStaff = staffProfileRepository
                                        .countByGarageIdAndStaffTypeAndIsActiveTrue(garageId, entry.getKey());
                        long assignedStaff = bookingAssignedStaffRepository
                                        .countAssignedStaffByGarageAndTypeAndTime(garageId, entry.getKey(), startTime,
                                                        endTime);

                        if ((totalStaff - assignedStaff) < entry.getValue()) {
                                throw new ResponseStatusException(HttpStatus.CONFLICT,
                                                "Not enough care staff available for this time slot");
                        }
                }
        }

        private boolean requiresWashBay(List<ServicePackage> servicePackages) {
                return servicePackages.stream()
                                .anyMatch(servicePackage -> Boolean.TRUE.equals(servicePackage.getRequiresWashBay()));
        }

        private List<Long> getBookingAddOnIds(Long bookingId) {
                if (bookingId == null)
                        return List.of();

                return bookingAddOnServicePackageRepository.findByBookingIdOrderBySortOrderAsc(bookingId).stream()
                                .map(BookingAddOnServicePackage::getServicePackageId)
                                .toList();
        }

        private String mapVehicleTypeToBayType(String vehicleType) {
                String normalized = normalizeVehicleType(vehicleType);

                if ("BIKE".equals(normalized)) {
                        return "BIKE";
                }

                return "CAR";
        }

        private String resolveGarageBayType(List<String> supportedVehicleTypes, String vehicleType) {
                String requestedType = normalizeVehicleType(vehicleType);

                for (String supportedType : supportedVehicleTypes) {
                        if (normalizeVehicleType(supportedType).equals(requestedType)) {
                                return supportedType;
                        }
                }

                return null;
        }

        private String normalizeVehicleType(String vehicleType) {
                if (vehicleType == null || vehicleType.isBlank()) {
                        return "";
                }

                String normalized = vehicleType.trim().toUpperCase();

                if (normalized.equals("MOTORBIKE")
                                || normalized.equals("BIKE")
                                || normalized.equals("MOTORCYCLE")
                                || normalized.equals("XE_MAY")) {
                        return "BIKE";
                }

                if (normalized.equals("CAR")
                                || normalized.equals("AUTO")
                                || normalized.equals("Ô TÔ")) {
                        return "CAR";
                }

                return normalized;
        }

        private boolean isWashBayAvailable(
                        Long garageId,
                        String vehicleType,
                        LocalDateTime start,
                        LocalDateTime end) {

                String bayType = mapVehicleTypeToBayType(vehicleType);

                // Dùng tổng bay active (bỏ qua status real-time) để kiểm tra slot tương lai
                long totalBays = washBayRepository.countActiveByGarageAndVehicleType(
                                garageId,
                                bayType);

                long occupied = bookingRepository.countOverlappingBookingsByGarageAndVehicleType(
                                garageId,
                                bayType,
                                start,
                                end);

                return occupied < totalBays;
        }

        private boolean isCareStaffAvailable(
                        Long garageId,
                        ServicePackage servicePackage,
                        LocalDateTime start,
                        LocalDateTime end) {

                if (!Boolean.TRUE.equals(servicePackage.getRequiresCareStaff())
                                || servicePackage.getCareStaffRequiredCount() <= 0) {

                        return true;
                }

                StaffType staffType = StaffType.valueOf(servicePackage.getCareStaffType());

                long totalStaff = staffProfileRepository
                                .countByGarageIdAndStaffTypeAndIsActiveTrue(
                                                garageId,
                                                staffType);

                long assigned = bookingAssignedStaffRepository
                                .countAssignedStaffByGarageAndTypeAndTime(
                                                garageId,
                                                staffType,
                                                start,
                                                end);

                return (totalStaff - assigned) >= servicePackage.getCareStaffRequiredCount();
        }

        // ===================== ISSUE #11 =====================

        @Override
        @Transactional
        public BookingResponse createBooking(BookingCreateRequest request, Long customerId) {

                User customer = userRepository.findById(customerId)
                                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                                                "Customer not found"));

                Vehicle vehicle = vehicleRepository.findByIdAndCustomer_Id(request.getVehicleId(), customerId)
                                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                                                "Vehicle not found or does not belong to current customer"));
                if (!Boolean.TRUE.equals(vehicle.getIsActive())) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Vehicle is inactive");
                }

                ServicePackage pkg = servicePackageRepository.findById(request.getServicePackageId())
                                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                                                "Service package not found"));
                if (!Boolean.TRUE.equals(pkg.getIsActive())) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Service package is inactive");
                }

                String mainPackageType = normalizeServiceType(pkg.getServiceType());
                if (!"MAIN".equals(mainPackageType) && !"COMBO".equals(mainPackageType)) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                                        "Main service package must have service type MAIN or COMBO");
                }

                List<ServicePackage> addOns = loadAddOnPackages(
                                request.getAddOnServicePackageIds(),
                                request.getServicePackageId(),
                                vehicle);
                List<ServicePackage> selectedPackages = buildSelectedPackages(pkg, addOns);

                Garage garage = garageRepository.findById(request.getGarageId())
                                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                                                "Garage not found"));
                if (!Boolean.TRUE.equals(garage.getIsActive())) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Garage is inactive");
                }

                LocalDateTime startTime = request.getStartTime();
                LocalDateTime endTime = startTime.plusMinutes(resolveSlotDurationMinutes(selectedPackages, garage));
                LocalDateTime now = LocalDateTime.now();

                if (!startTime.isAfter(now)) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                                        "Booking time must be in the future");
                }

                if (startTime.toLocalDate().isBefore(LocalDate.now().plusDays(1))) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                                        "Booking must be made at least 1 day in advance");
                }

                String bayType = mapVehicleTypeToBayType(vehicle.getVehicleType());
                List<String> supportedTypes = washBayRepository
                                .findDistinctVehicleTypesByGarageId(request.getGarageId());
                if (resolveGarageBayType(supportedTypes, vehicle.getVehicleType()) == null) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                                        "Garage does not support vehicle type: " + vehicle.getVehicleType());
                }

                if (!isVehicleTypeCompatible(
                                vehicle,
                                pkg)) {

                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "Vehicle is not compatible with selected service package");
                }

                CustomerLoyalty loyalty = customerLoyaltyRepository.findByCustomerId(customerId).orElse(null);
                String tier = loyalty != null ? loyalty.getCurrentTier() : "NEW";

                // "NEW" (not yet ranked) has no rule row of its own — booking limits fall back
                // to BRONZE, the baseline tier, until the customer earns an actual rank.
                LoyaltyTierRule tierRule = loyaltyTierRuleRepository.findByTierAndIsActiveTrue(tier)
                                .or(() -> loyaltyTierRuleRepository.findByTierAndIsActiveTrue("BRONZE"))
                                .orElseThrow(() -> new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                                                "Loyalty tier rule not found for tier: " + tier));

                int allowedBookingWindowDays = tierRule.getBookingWindowDays();
                LocalDateTime maxBookingTime = now.plusDays(allowedBookingWindowDays);
                if (startTime.isAfter(maxBookingTime)) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                                        "Booking date exceeds allowed window of " + allowedBookingWindowDays
                                                        + " days for tier " + tier);
                }

                long upcomingCount = bookingRepository.countUpcomingBookings(customerId, now);
                if (upcomingCount >= tierRule.getMaxUpcomingBookings()) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                                        "Exceeded maximum upcoming bookings limit of "
                                                        + tierRule.getMaxUpcomingBookings() + " for tier " + tier);
                }

                long vehicleOverlap = bookingRepository.countOverlappingBookingsByVehicle(
                                request.getVehicleId(), startTime, endTime);
                if (vehicleOverlap > 0) {
                        throw new ResponseStatusException(HttpStatus.CONFLICT,
                                        "Vehicle already has an active booking during this time");
                }

                long customerGarageOverlap = bookingRepository.countOverlappingBookingsByCustomerAndGarage(
                                customerId, request.getGarageId(), startTime, endTime);
                if (customerGarageOverlap > 0) {
                        throw new ResponseStatusException(HttpStatus.CONFLICT,
                                        "Bạn đã có lịch đặt tại garage này trong khung giờ này");
                }

                // Issue #3/#4: compute per-phase windows so overlap checks use the right window
                ResourceWindows rw = computeResourceWindows(selectedPackages);
                LocalDateTime plannedWashEnd = rw.requiresWashBay
                                ? startTime.plusMinutes(rw.totalWashMinutes) : endTime;
                LocalDateTime plannedCareStart = rw.requiresCareStaff ? plannedWashEnd : null;
                LocalDateTime plannedCareEnd = rw.requiresCareStaff
                                ? plannedWashEnd.plusMinutes(rw.totalCareMinutes) : null;

                if (rw.requiresWashBay) {
                        long totalBays = washBayRepository
                                        .countActiveByGarageAndVehicleType(request.getGarageId(), bayType);
                        long occupiedBays = bookingRepository.countOverlappingBookingsByGarageAndVehicleType(
                                        request.getGarageId(), bayType, startTime, plannedWashEnd);
                        if (occupiedBays >= totalBays) {
                                throw new ResponseStatusException(HttpStatus.CONFLICT,
                                                "No wash bay available for this time slot");
                        }
                }

                if (rw.requiresCareStaff && plannedCareStart != null && plannedCareEnd != null) {
                        validateCareStaffAvailability(request.getGarageId(), selectedPackages,
                                        plannedCareStart, plannedCareEnd);
                }

                BigDecimal originalPrice = sumBasePrice(selectedPackages);
                BigDecimal discountAmount = BigDecimal.ZERO;
                BigDecimal promotionDiscountAmount = BigDecimal.ZERO;
                Long promotionId = null;

                if (request.getPromotionCode() != null && !request.getPromotionCode().isBlank()) {

                        PromotionValidateRequest validateRequest = new PromotionValidateRequest();

                        validateRequest.setPromotionCode(request.getPromotionCode());
                        validateRequest.setServicePackageId(request.getServicePackageId());
                        validateRequest.setOrderAmount(originalPrice);

                        PromotionValidateResponse response = promotionService.validatePromotion(customerId,
                                        validateRequest);

                        promotionId = response.getPromotionId();
                        promotionDiscountAmount = response.getDiscountAmount();
                        discountAmount = discountAmount.add(promotionDiscountAmount);

                }
                int usedPoints = request.getUsedPoints() != null ? request.getUsedPoints() : 0;
                if (usedPoints > 0) {
                        if (loyalty == null || loyalty.getAvailablePoints() < usedPoints) {
                                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                                                "Insufficient loyalty points");
                        }
                        BigDecimal pointDiscount = BigDecimal.valueOf(usedPoints * 1000L);
                        discountAmount = discountAmount.add(pointDiscount);
                }

                if (discountAmount.compareTo(originalPrice) > 0) {
                        discountAmount = originalPrice;
                }

                BigDecimal finalPrice = originalPrice.subtract(discountAmount);
                BigDecimal depositAmount = finalPrice
                                .multiply(DEPOSIT_PERCENT)
                                .setScale(2, RoundingMode.HALF_UP);
                LocalDateTime paymentExpiredAt = LocalDateTime.now()
                                .plusMinutes(PAYMENT_TIMEOUT_MINUTES);

                Booking booking = new Booking();
                booking.setCustomerId(customerId);
                booking.setVehicleId(request.getVehicleId());
                booking.setVehicleType(bayType);
                booking.setGarageId(request.getGarageId());
                booking.setServicePackageId(request.getServicePackageId());
                booking.setPromotionId(promotionId);
                booking.setBookingDate(startTime.toLocalDate());
                booking.setStartTime(startTime);
                booking.setEndTime(endTime);

                booking.setStatus("PENDING_DEPOSIT");

                booking.setPaymentStatus("UNPAID");

                booking.setPaymentMethod("PAYOS");

                booking.setOriginalPrice(originalPrice);
                booking.setSurchargeAmount(BigDecimal.ZERO);
                booking.setDiscountAmount(discountAmount);
                booking.setPromotionDiscountAmount(
                                promotionDiscountAmount);
                booking.setFinalPrice(finalPrice);

                booking.setDepositAmount(depositAmount);

                booking.setDepositStatus("UNPAID");

                booking.setPaymentExpiredAt(paymentExpiredAt);

                booking.setRefundAmount(BigDecimal.ZERO);

                booking.setIsWalkIn(false);
                booking.setRewardProcessed(false);
                booking.setUsedPoints(usedPoints);
                booking.setNote(request.getNote());
                booking.setPlannedWashStartAt(rw.requiresWashBay ? startTime : null);
                booking.setPlannedWashEndAt(rw.requiresWashBay ? plannedWashEnd : null);
                booking.setPlannedCareStartAt(plannedCareStart);
                booking.setPlannedCareEndAt(plannedCareEnd);

                Booking saved = bookingRepository.save(booking);
                PaymentTransaction transaction = new PaymentTransaction();

                transaction.setBookingId(saved.getId());

                transaction.setPaymentMethod("PAYOS");

                transaction.setAmount(saved.getDepositAmount());

                transaction.setStatus("PENDING");

                transaction.setOrderCode(
                                System.currentTimeMillis());

                transaction.setExpiredAt(
                                paymentExpiredAt);

                paymentTransactionRepository.save(
                                transaction);

                if (usedPoints > 0) {
                        loyaltyPointExpiryService.consumePointsFifo(customerId, usedPoints, saved.getId());
                }

                int sortOrder = 1;
                for (ServicePackage addOn : addOns) {
                        BookingAddOnServicePackage bookingAddOn = new BookingAddOnServicePackage();
                        bookingAddOn.setBookingId(saved.getId());
                        bookingAddOn.setServicePackageId(addOn.getId());
                        bookingAddOn.setSortOrder(sortOrder++);
                        bookingAddOnServicePackageRepository.save(bookingAddOn);
                }

                // TODO ISSUE-55
                // loyaltyService.updateBookingStatistics(saved.getId());

                // TODO ISSUE-55
                // Promotion will be locked after successful deposit payment.
                // if (promotionId != null
                // && !promotionUsageRepository.existsByBookingId(saved.getId())) {
                //
                // PromotionUsage usage = new PromotionUsage();
                // usage.setPromotionId(promotionId);
                // usage.setBookingId(saved.getId());
                // usage.setCustomerId(customerId);
                // usage.setDiscountAmount(promotionDiscountAmount);
                // usage.setUsedAt(LocalDateTime.now());
                // promotionUsageRepository.save(usage);
                //
                // promotionRepository.findById(promotionId).ifPresent(p -> {
                // p.setUsedCount(p.getUsedCount() + 1);
                // promotionRepository.save(p);
                // });
                // }

                // TODO ISSUE-55
                // notificationService.notifyDepositCreated(saved.getId());

                // notificationService.notifyBookingConfirmed(saved.getId());
                BookingResponse response = toResponse(saved);
                response.setAddOnServicePackageIds(addOns.stream().map(ServicePackage::getId).toList());
                return response;
        }

        // ===================== ISSUE #12 =====================

        @Override
        @Transactional
        public BookingResponse createWalkInBooking(WalkInBookingCreateRequest request, Long staffUserId, String role) {

                staffOperationAccessPolicy.requireCustomerServiceOrAdminForGarage(staffUserId, role, request.getGarageId());

                Garage garage = garageRepository.findById(request.getGarageId())
                                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                                                "Garage not found"));
                if (!Boolean.TRUE.equals(garage.getIsActive())) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Garage is inactive");
                }

                ServicePackage pkg = servicePackageRepository.findById(request.getServicePackageId())
                                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                                                "Service package not found"));
                if (!Boolean.TRUE.equals(pkg.getIsActive())) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Service package is inactive");
                }

                List<ServicePackage> addOns = loadWalkInAddOnPackages(
                                request.getAddOnServicePackageIds(),
                                request.getServicePackageId(),
                                request);
                List<ServicePackage> selectedPackages = buildSelectedPackages(pkg, addOns);

                String bayType = VietnameseLicensePlate.normalizeVehicleType(request.getVehicleType());
                String normalizedPlate = VietnameseLicensePlate.normalizeAndValidate(
                                request.getLicensePlate(), bayType);

                LocalDateTime startTime = request.getStartTime();
                LocalDateTime endTime = startTime.plusMinutes(resolveSlotDurationMinutes(selectedPackages, garage));

                List<String> supportedTypes = washBayRepository
                                .findDistinctVehicleTypesByGarageId(request.getGarageId());
                if (resolveGarageBayType(supportedTypes, request.getVehicleType()) == null) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                                        "Garage does not support vehicle type: " + request.getVehicleType());
                }

                if (!isWalkInVehicleCompatible(request, pkg)) {

                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "Vehicle is not compatible with selected service package");
                }

                long plateOverlap = bookingRepository.countOverlappingBookingsByLicensePlateAndVehicleType(
                                normalizedPlate, bayType, startTime, endTime);
                if (plateOverlap > 0) {
                        throw new ResponseStatusException(HttpStatus.CONFLICT,
                                        "License plate already has an active booking during this time");
                }

                // Issue #3/#4: compute per-phase windows so overlap checks use the right window
                ResourceWindows rw = computeResourceWindows(selectedPackages);
                LocalDateTime plannedWashEnd = rw.requiresWashBay
                                ? startTime.plusMinutes(rw.totalWashMinutes) : endTime;
                LocalDateTime plannedCareStart = rw.requiresCareStaff ? plannedWashEnd : null;
                LocalDateTime plannedCareEnd = rw.requiresCareStaff
                                ? plannedWashEnd.plusMinutes(rw.totalCareMinutes) : null;

                if (rw.requiresWashBay) {
                        long totalBays = washBayRepository.countActiveByGarageAndVehicleType(
                                        request.getGarageId(), bayType);
                        long occupiedBays = bookingRepository.countOverlappingBookingsByGarageAndVehicleType(
                                        request.getGarageId(), bayType, startTime, plannedWashEnd);
                        if (occupiedBays >= totalBays) {
                                throw new ResponseStatusException(HttpStatus.CONFLICT,
                                                "No wash bay available for this time slot");
                        }
                }

                if (rw.requiresCareStaff && plannedCareStart != null && plannedCareEnd != null) {
                        validateCareStaffAvailability(request.getGarageId(), selectedPackages,
                                        plannedCareStart, plannedCareEnd);
                }

                User matchedCustomer = findActiveCustomerByPhone(request.getGuestPhone());
                Vehicle matchedVehicle = findMatchedCustomerVehicle(matchedCustomer, normalizedPlate, bayType);

                if (matchedCustomer != null) {
                        long customerGarageOverlap = bookingRepository.countOverlappingBookingsByCustomerAndGarage(
                                        matchedCustomer.getId(), request.getGarageId(), startTime, endTime);
                        if (customerGarageOverlap > 0) {
                                throw new ResponseStatusException(HttpStatus.CONFLICT,
                                                "Khách hàng này đã có lịch đặt tại garage trong khung giờ này");
                        }
                }

                if (matchedCustomer != null && matchedVehicle == null) {
                        assertLicensePlateAvailable(normalizedPlate, bayType);
                        Vehicle newVehicle = new Vehicle();
                        newVehicle.setCustomer(matchedCustomer);
                        newVehicle.setRawLicensePlate(request.getLicensePlate().trim());
                        newVehicle.setNormalizedLicensePlate(normalizedPlate);
                        newVehicle.setVehicleType(bayType);
                        String brand = request.getVehicleBrand() != null && !request.getVehicleBrand().isBlank()
                                        ? request.getVehicleBrand().trim()
                                        : "Không rõ";
                        String model = request.getVehicleModel() != null && !request.getVehicleModel().isBlank()
                                        ? request.getVehicleModel().trim()
                                        : "Không rõ";
                        newVehicle.setBrand(brand);
                        newVehicle.setModel(model);
                        newVehicle.setSeatCount(request.getSeatCount());
                        newVehicle.setMotorbikeGroup(request.getMotorbikeGroup());
                        newVehicle.setIsDefault(false);
                        newVehicle.setIsActive(true);
                        matchedVehicle = vehicleRepository.save(newVehicle);
                }

                String depositPaymentMethod = normalizeWalkInPaymentMethod(
                                request.getPaymentMethod());

                BigDecimal originalPrice = sumBasePrice(selectedPackages);

                BigDecimal depositAmount = BigDecimal.ZERO;

                String bookingStatus = "CONFIRMED";

                String depositStatus = "PAID";

                LocalDateTime paymentExpiredAt = null;

                if ("CASH".equals(depositPaymentMethod)) {

                        depositAmount = originalPrice
                                        .multiply(DEPOSIT_PERCENT)
                                        .setScale(2, RoundingMode.HALF_UP);

                } else if ("PAYOS".equals(depositPaymentMethod)) {

                        depositAmount = originalPrice
                                        .multiply(DEPOSIT_PERCENT)
                                        .setScale(2, RoundingMode.HALF_UP);

                        bookingStatus = "PENDING_DEPOSIT";

                        depositStatus = "UNPAID";

                        paymentExpiredAt = LocalDateTime.now()
                                        .plusMinutes(
                                                        PAYMENT_TIMEOUT_MINUTES);

                }

                Booking booking = new Booking();
                booking.setCustomerId(matchedCustomer != null ? matchedCustomer.getId() : null);
                booking.setVehicleId(matchedVehicle != null ? matchedVehicle.getId() : null);
                booking.setVehicleType(bayType);
                booking.setGarageId(request.getGarageId());
                booking.setServicePackageId(request.getServicePackageId());
                booking.setCreatedByStaffId(staffUserId);
                booking.setBookingDate(startTime.toLocalDate());
                booking.setStartTime(startTime);
                booking.setEndTime(endTime);
                booking.setStatus("CONFIRMED");
                booking.setPaymentStatus("UNPAID");
                booking.setPaymentMethod(depositPaymentMethod);
                booking.setOriginalPrice(originalPrice);
                booking.setSurchargeAmount(BigDecimal.ZERO);
                booking.setDiscountAmount(BigDecimal.ZERO);
                booking.setFinalPrice(originalPrice);
                booking.setDepositAmount(BigDecimal.ZERO);
                booking.setDepositStatus("UNPAID");
                booking.setRefundAmount(BigDecimal.ZERO);
                booking.setIsWalkIn(true);
                booking.setGuestName(matchedCustomer != null ? matchedCustomer.getFullName() : request.getGuestName());
                booking.setGuestPhone(matchedCustomer != null ? matchedCustomer.getPhone()
                                : VietnamesePhoneNumber.normalizeMobile(request.getGuestPhone()));
                booking.setLicensePlate(normalizedPlate);
                booking.setRewardProcessed(false);
                booking.setUsedPoints(0);
                booking.setNote(request.getNote());
                booking.setPlannedWashStartAt(rw.requiresWashBay ? startTime : null);
                booking.setPlannedWashEndAt(rw.requiresWashBay ? plannedWashEnd : null);
                booking.setPlannedCareStartAt(plannedCareStart);
                booking.setPlannedCareEndAt(plannedCareEnd);

                Booking saved = bookingRepository.save(booking);
                if ("PAYOS".equalsIgnoreCase(depositPaymentMethod)) {

                        PaymentTransaction transaction = new PaymentTransaction();

                        transaction.setBookingId(saved.getId());

                        transaction.setPaymentMethod("PAYOS");

                        transaction.setAmount(saved.getDepositAmount());

                        transaction.setStatus("PENDING");

                        transaction.setOrderCode(System.currentTimeMillis());

                        transaction.setExpiredAt(paymentExpiredAt);

                        paymentTransactionRepository.save(transaction);

                }
                int sortOrder = 1;
                for (ServicePackage addOn : addOns) {
                        BookingAddOnServicePackage bookingAddOn = new BookingAddOnServicePackage();
                        bookingAddOn.setBookingId(saved.getId());
                        bookingAddOn.setServicePackageId(addOn.getId());
                        bookingAddOn.setSortOrder(sortOrder++);
                        bookingAddOnServicePackageRepository.save(bookingAddOn);
                }

                // Issue #5: Reserve care staff immediately for CONFIRMED walk-in bookings
                if ("CONFIRMED".equals(saved.getStatus()) && rw.requiresCareStaff
                                && plannedCareStart != null && plannedCareEnd != null) {
                        reserveCareStaff(saved, rw, plannedCareStart, plannedCareEnd);
                }

                loyaltyService.updateBookingStatistics(saved.getId());
                notificationService.notifyBookingConfirmed(saved.getId());
                return toResponse(saved);
        }

        @Override
        public BookingResponse createGuestBooking(WalkInBookingCreateRequest request) {

                Garage garage = garageRepository.findById(request.getGarageId())
                                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                                                "Garage not found"));
                if (!Boolean.TRUE.equals(garage.getIsActive())) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Garage is inactive");
                }

                ServicePackage pkg = servicePackageRepository.findById(request.getServicePackageId())
                                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                                                "Service package not found"));
                if (!Boolean.TRUE.equals(pkg.getIsActive())) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Service package is inactive");
                }

                List<ServicePackage> addOns = loadWalkInAddOnPackages(
                                request.getAddOnServicePackageIds(),
                                request.getServicePackageId(),
                                request);
                List<ServicePackage> selectedPackages = buildSelectedPackages(pkg, addOns);

                String bayType = VietnameseLicensePlate.normalizeVehicleType(request.getVehicleType());
                String normalizedPlate = VietnameseLicensePlate.normalizeAndValidate(
                                request.getLicensePlate(), bayType);

                LocalDateTime startTime = request.getStartTime();
                LocalDateTime endTime = startTime.plusMinutes(resolveSlotDurationMinutes(selectedPackages, garage));

                List<String> supportedTypes = washBayRepository
                                .findDistinctVehicleTypesByGarageId(request.getGarageId());
                if (resolveGarageBayType(supportedTypes, request.getVehicleType()) == null) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                                        "Garage does not support vehicle type: " + request.getVehicleType());
                }

                if (!isWalkInVehicleCompatible(
                                request,
                                pkg)) {

                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "Vehicle is not compatible with selected service package");
                }

                long plateOverlap = bookingRepository.countOverlappingBookingsByLicensePlateAndVehicleType(
                                normalizedPlate, bayType, startTime, endTime);
                if (plateOverlap > 0) {
                        throw new ResponseStatusException(HttpStatus.CONFLICT,
                                        "License plate already has an active booking during this time");
                }

                // Issue #3/#4: compute per-phase windows so overlap checks use the right window
                ResourceWindows rw = computeResourceWindows(selectedPackages);
                LocalDateTime plannedWashEnd = rw.requiresWashBay
                                ? startTime.plusMinutes(rw.totalWashMinutes) : endTime;
                LocalDateTime plannedCareStart = rw.requiresCareStaff ? plannedWashEnd : null;
                LocalDateTime plannedCareEnd = rw.requiresCareStaff
                                ? plannedWashEnd.plusMinutes(rw.totalCareMinutes) : null;

                if (rw.requiresWashBay) {
                        long totalBays = washBayRepository.countActiveByGarageAndVehicleType(
                                        request.getGarageId(), bayType);
                        long occupiedBays = bookingRepository.countOverlappingBookingsByGarageAndVehicleType(
                                        request.getGarageId(), bayType, startTime, plannedWashEnd);
                        if (occupiedBays >= totalBays) {
                                throw new ResponseStatusException(HttpStatus.CONFLICT,
                                                "No wash bay available for this time slot");
                        }
                }

                if (rw.requiresCareStaff && plannedCareStart != null && plannedCareEnd != null) {
                        validateCareStaffAvailability(request.getGarageId(), selectedPackages,
                                        plannedCareStart, plannedCareEnd);
                }

                User matchedCustomer = findActiveCustomerByPhone(request.getGuestPhone());
                Vehicle matchedVehicle = findMatchedCustomerVehicle(matchedCustomer, normalizedPlate, bayType);

                if (matchedCustomer != null) {
                        long customerGarageOverlap = bookingRepository.countOverlappingBookingsByCustomerAndGarage(
                                        matchedCustomer.getId(), request.getGarageId(), startTime, endTime);
                        if (customerGarageOverlap > 0) {
                                throw new ResponseStatusException(HttpStatus.CONFLICT,
                                                "Khách hàng này đã có lịch đặt tại garage trong khung giờ này");
                        }
                }

                // Auto-save new vehicle for known customers when the plate is not in their profile yet
                if (matchedCustomer != null && matchedVehicle == null) {
                        assertLicensePlateAvailable(normalizedPlate, bayType);
                        Vehicle newVehicle = new Vehicle();
                        newVehicle.setCustomer(matchedCustomer);
                        newVehicle.setRawLicensePlate(request.getLicensePlate().trim());
                        newVehicle.setNormalizedLicensePlate(normalizedPlate);
                        newVehicle.setVehicleType(bayType);
                        String brand = request.getVehicleBrand() != null && !request.getVehicleBrand().isBlank()
                                        ? request.getVehicleBrand().trim() : "Không rõ";
                        String model = request.getVehicleModel() != null && !request.getVehicleModel().isBlank()
                                        ? request.getVehicleModel().trim() : "Không rõ";
                        newVehicle.setBrand(brand);
                        newVehicle.setModel(model);
                        newVehicle.setSeatCount(request.getSeatCount());
                        newVehicle.setMotorbikeGroup(request.getMotorbikeGroup());
                        newVehicle.setIsDefault(false);
                        newVehicle.setIsActive(true);
                        matchedVehicle = vehicleRepository.save(newVehicle);
                }

                BigDecimal originalPrice = sumBasePrice(selectedPackages);
                BigDecimal depositAmount = originalPrice
                                .multiply(DEPOSIT_PERCENT)
                                .setScale(2, RoundingMode.HALF_UP);
                LocalDateTime paymentExpiredAt = LocalDateTime.now()
                                .plusMinutes(PAYMENT_TIMEOUT_MINUTES);

                Booking booking = new Booking();
                booking.setCustomerId(matchedCustomer != null ? matchedCustomer.getId() : null);
                booking.setVehicleId(matchedVehicle != null ? matchedVehicle.getId() : null);
                booking.setVehicleType(bayType);
                booking.setGarageId(request.getGarageId());
                booking.setServicePackageId(request.getServicePackageId());
                booking.setBookingDate(startTime.toLocalDate());
                booking.setStartTime(startTime);
                booking.setEndTime(endTime);
                booking.setStatus("PENDING_DEPOSIT");
                booking.setPaymentStatus("UNPAID");
                booking.setPaymentMethod("PAYOS");
                booking.setOriginalPrice(originalPrice);
                booking.setSurchargeAmount(BigDecimal.ZERO);
                booking.setDiscountAmount(BigDecimal.ZERO);
                booking.setFinalPrice(originalPrice);
                booking.setDepositAmount(depositAmount);
                booking.setDepositStatus("UNPAID");
                booking.setPaymentExpiredAt(paymentExpiredAt);
                booking.setRefundAmount(BigDecimal.ZERO);
                booking.setIsWalkIn(false);
                booking.setGuestName(matchedCustomer != null ? matchedCustomer.getFullName() : request.getGuestName());
                booking.setGuestPhone(matchedCustomer != null
                                ? matchedCustomer.getPhone()
                                : VietnamesePhoneNumber.normalizeMobile(request.getGuestPhone()));
                booking.setLicensePlate(normalizedPlate);
                booking.setRewardProcessed(false);
                booking.setUsedPoints(0);
                booking.setNote(request.getNote());
                booking.setPlannedWashStartAt(rw.requiresWashBay ? startTime : null);
                booking.setPlannedWashEndAt(rw.requiresWashBay ? plannedWashEnd : null);
                booking.setPlannedCareStartAt(plannedCareStart);
                booking.setPlannedCareEndAt(plannedCareEnd);

                Booking saved = bookingRepository.save(booking);

                int sortOrder = 1;
                for (ServicePackage addOn : addOns) {
                        BookingAddOnServicePackage bookingAddOn = new BookingAddOnServicePackage();
                        bookingAddOn.setBookingId(saved.getId());
                        bookingAddOn.setServicePackageId(addOn.getId());
                        bookingAddOn.setSortOrder(sortOrder++);
                        bookingAddOnServicePackageRepository.save(bookingAddOn);
                }

                return toResponse(saved);
        }

        @Override
        public WalkInCustomerLookupResponse lookupWalkInCustomerByPhone(
                        String phone,
                        String licensePlate,
                        String vehicleType,
                        Long callerId,
                        String role) {
                staffOperationAccessPolicy.requireCustomerServiceOrAdmin(callerId, role);
                User customer = findActiveCustomerByPhone(phone);
                if (customer == null) {
                        return WalkInCustomerLookupResponse.builder()
                                        .found(false)
                                        .build();
                }

                boolean hasPlate = licensePlate != null && !licensePlate.isBlank();
                boolean hasVehicleType = vehicleType != null && !vehicleType.isBlank();
                String normalizedType = hasVehicleType
                                ? VietnameseLicensePlate.normalizeVehicleType(vehicleType)
                                : null;
                String normalizedPlate = hasPlate && normalizedType != null
                                ? VietnameseLicensePlate.normalizeAndValidate(licensePlate, normalizedType)
                                : null;
                Vehicle matchedVehicle = normalizedPlate == null
                                ? null
                                : findMatchedCustomerVehicle(customer, normalizedPlate, normalizedType);

                String matchedVehicleName = buildVehicleName(matchedVehicle);

                List<WalkInCustomerLookupResponse.VehicleSummary> vehicleSummaries = vehicleRepository
                                .findByCustomer_IdAndIsActiveTrue(customer.getId())
                                .stream()
                                .map(v -> WalkInCustomerLookupResponse.VehicleSummary.builder()
                                                .id(v.getId())
                                                .licensePlate(v.getRawLicensePlate() != null
                                                                && !v.getRawLicensePlate().isBlank()
                                                                                ? v.getRawLicensePlate()
                                                                                : v.getNormalizedLicensePlate())
                                                .vehicleType(v.getVehicleType())
                                                .vehicleName(buildVehicleName(v))
                                                .build())
                                .collect(java.util.stream.Collectors.toList());

                return WalkInCustomerLookupResponse.builder()
                                .found(true)
                                .customerId(customer.getId())
                                .fullName(customer.getFullName())
                                .phone(customer.getPhone())
                                .email(customer.getEmail())
                                .vehicleId(matchedVehicle != null ? matchedVehicle.getId() : null)
                                .licensePlate(matchedVehicle != null
                                                ? (matchedVehicle.getRawLicensePlate() != null
                                                                && !matchedVehicle.getRawLicensePlate().isBlank()
                                                                                ? matchedVehicle.getRawLicensePlate()
                                                                                : matchedVehicle.getNormalizedLicensePlate())
                                                : null)
                                .vehicleType(matchedVehicle != null ? matchedVehicle.getVehicleType() : null)
                                .vehicleName(matchedVehicleName)
                                .vehicles(vehicleSummaries)
                                .build();
        }

        private String buildVehicleName(Vehicle v) {
                if (v == null)
                        return null;
                String brand = v.getBrand();
                String model = v.getModel();
                if (brand != null && !brand.isBlank() && model != null && !model.isBlank()
                                && !"Không rõ".equalsIgnoreCase(brand.trim())) {
                        return brand.trim() + " " + model.trim();
                }
                return null;
        }

        // ===================== ISSUE #13 =====================
        @Override
        @Transactional(readOnly = true)
        public List<BookingSummaryResponse> getPendingRefundBookings(
                        Long staffUserId,
                        String role) {

                List<Booking> bookings;

                StaffProfile pendingRefundProfile = staffOperationAccessPolicy.requireCustomerServiceOrAdmin(staffUserId, role);

                if (pendingRefundProfile == null) {

                        bookings = bookingRepository.findRefundPendingBookings();

                } else {

                        bookings = bookingRepository
                                        .findRefundPendingBookings()
                                        .stream()
                                        .filter(b -> Objects.equals(pendingRefundProfile.getGarageId(), b.getGarageId()))
                                        .toList();

                }

                return bookings.stream()
                                // Registered customers use the auditable deposit_refunds
                                // request -> review -> execute workflow. Keep this legacy
                                // staff queue only for guest/walk-in refunds.
                                .filter(booking -> booking.getCustomerId() == null)
                                .map(this::toSummaryResponse)
                                .toList();

        }

        @Override
        public List<BookingSummaryResponse> getCustomerBookings(
                        Long customerId,
                        String status) {

                List<Booking> bookings = bookingRepository.findByCustomerIdOrderByStartTimeDesc(customerId);

                // Build a Map<bookingId → 1-based position> sorted by id ASC (oldest = #1)
                // This avoids N+1 queries — compute the map once for all bookings.
                Map<Long, Integer> seqMap = new HashMap<>();
                List<Booking> sortedById = bookings.stream()
                                .sorted(java.util.Comparator.comparingLong(Booking::getId))
                                .toList();
                for (int i = 0; i < sortedById.size(); i++) {
                        seqMap.put(sortedById.get(i).getId(), i + 1);
                }

                return bookings.stream()

                                .filter(b -> status == null
                                                || status.isBlank()
                                                || b.getStatus().equalsIgnoreCase(status))

                                .map(b -> {
                                        BookingSummaryResponse r = toSummaryResponse(b);
                                        r.setCustomerBookingNumber(seqMap.get(b.getId()));
                                        return r;
                                })

                                .toList();
        }

        @Override
        public BookingResponse getCustomerBookingDetail(
                        Long bookingId,
                        Long customerId) {

                Booking booking = bookingRepository
                                .findByIdAndCustomerId(bookingId, customerId)
                                .orElseThrow(() -> new ResponseStatusException(
                                                HttpStatus.NOT_FOUND,
                                                "Booking not found"));

                return toResponse(booking);
        }

        @Override
        public List<BookingSummaryResponse> getStaffBookings(
                        Long staffUserId,
                        String role,
                        String status,
                        LocalDate date) {

                // Explicit allow-list: only CUSTOMER_SERVICE_STAFF sees the garage booking list.
                // VEHICLE_CARE_STAFF, SERVICE_ADVISOR, MANAGER, and any unknown type are denied.
                requiresServiceOrAdmin(staffUserId, role);

                StaffProfile staffProfile = staffProfileRepository
                                .findByUser_Id(staffUserId)
                                .orElseThrow(() -> new ResponseStatusException(
                                                HttpStatus.FORBIDDEN,
                                                "Staff profile not found"));

                if (!Boolean.TRUE.equals(staffProfile.getIsActive())) {
                        throw new ResponseStatusException(
                                        HttpStatus.FORBIDDEN,
                                        "Staff profile is inactive");
                }

                List<Booking> bookings;

                if (date != null) {

                        bookings = bookingRepository.findByGarageIdAndBookingDateOrderByStartTimeDesc(
                                        staffProfile.getGarageId(),
                                        date);

                } else {

                        bookings = bookingRepository.findByGarageIdOrderByStartTimeDesc(
                                        staffProfile.getGarageId());

                }

                return bookings.stream()

                                .filter(b -> status == null
                                                || status.isBlank()
                                                || b.getStatus().equalsIgnoreCase(status))

                                .map(this::toSummaryResponse)

                                .toList();
        }

        @Override
        public List<BookingSummaryResponse> getAdminBookings(
                        Long garageId,
                        String status,
                        String paymentStatus) {

                List<Booking> bookings = bookingRepository.findAllByOrderByStartTimeDesc();

                return bookings.stream()

                                .filter(b -> garageId == null
                                                || b.getGarageId().equals(garageId))

                                .filter(b -> status == null
                                                || status.isBlank()
                                                || b.getStatus().equalsIgnoreCase(status))

                                .filter(b -> paymentStatus == null
                                                || paymentStatus.isBlank()
                                                || b.getPaymentStatus().equalsIgnoreCase(paymentStatus))

                                .map(this::toSummaryResponse)

                                .toList();
        }

        // ===================== ISSUE #14 =====================
        @Override
        @Transactional
        public BookingResponse checkInBooking(
                        Long bookingId,
                        Long staffUserId,
                        String role,
                        String note) {

                requiresServiceOrAdmin(staffUserId, role);

                Booking booking = bookingRepository.findById(bookingId)
                                .orElseThrow(() -> new ResponseStatusException(
                                                HttpStatus.NOT_FOUND,
                                                "Booking not found"));

                if (!"ROLE_ADMIN".equals(role)) {
                        StaffProfile staff = staffProfileRepository
                                        .findByUser_Id(staffUserId)
                                        .orElseThrow(() -> new ResponseStatusException(
                                                        HttpStatus.FORBIDDEN,
                                                        "Staff profile not found"));

                        if (!booking.getGarageId().equals(staff.getGarageId())) {

                                throw new ResponseStatusException(
                                                HttpStatus.FORBIDDEN,
                                                "Booking belongs to another garage");
                        }
                }

                if (!"CONFIRMED".equals(booking.getStatus())) {

                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "Only confirmed booking can be checked in");
                }

                booking.setStatus("CHECKED_IN");
                booking.setOperationPhase("WAITING_FOR_INTAKE");

                booking.setCheckedInAt(
                                LocalDateTime.now());

                if (note != null && !note.isBlank()) {

                        booking.setNote(note);
                }

                Booking saved = bookingRepository.save(booking);

                return toResponse(saved);
        }

        // ===================== ISSUE #16 =====================
        @Override
        @Transactional
        public BookingResponse startService(
                        Long bookingId,
                        Long staffUserId,
                        String role,
                        StartServiceRequest request) {

                requiresServiceOrAdmin(staffUserId, role);

                Booking booking = bookingRepository
                                .findById(bookingId)
                                .orElseThrow(() -> new ResponseStatusException(
                                                HttpStatus.NOT_FOUND,
                                                "Booking not found"));

                if (!"ROLE_ADMIN".equals(role)) {
                        StaffProfile staff = staffProfileRepository
                                        .findByUser_Id(staffUserId)
                                        .orElseThrow(() -> new ResponseStatusException(
                                                        HttpStatus.FORBIDDEN,
                                                        "Staff profile not found"));

                        if (!Boolean.TRUE.equals(staff.getIsActive())) {
                                throw new ResponseStatusException(
                                                HttpStatus.FORBIDDEN,
                                                "Staff profile is inactive");
                        }

                        if (!booking.getGarageId().equals(staff.getGarageId())) {
                                throw new ResponseStatusException(
                                                HttpStatus.FORBIDDEN,
                                                "Booking belongs to another garage");
                        }
                }

                if (!"CHECKED_IN".equals(booking.getStatus())) {
                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "Only checked-in booking can start service");
                }

                ServicePackage servicePackage = servicePackageRepository
                                .findById(booking.getServicePackageId())
                                .orElseThrow(() -> new ResponseStatusException(
                                                HttpStatus.NOT_FOUND,
                                                "Service package not found"));

                LocalDateTime startedAt = LocalDateTime.now();

                // ================= Assign Wash Bay =================
                if (Boolean.TRUE.equals(servicePackage.getRequiresWashBay())) {

                        String bayType = mapVehicleTypeToBayType(servicePackage.getVehicleType());

                        WashBay washBay = washBayRepository
                                        .findFirstByGarageIdAndVehicleTypeAndStatusAndIsActiveTrue(
                                                        booking.getGarageId(),
                                                        bayType,
                                                        WashBayStatus.AVAILABLE)
                                        .orElseThrow(() -> new ResponseStatusException(
                                                        HttpStatus.BAD_REQUEST,
                                                        "No wash bay available"));

                        booking.setWashBayId(washBay.getId());
                        booking.setWashBayStartTime(startedAt);

                        washBay.setStatus(WashBayStatus.IN_USE);

                        washBay.setCurrentBookingId(booking.getId());

                        washBayRepository.save(washBay);
                }

                // ================= Assign Care Staff =================
                if (Boolean.TRUE.equals(servicePackage.getRequiresCareStaff())) {
                        StaffType staffType = StaffType.valueOf(servicePackage.getCareStaffType());
                        List<StaffProfile> staffs = staffProfileRepository
                                        .findByGarageIdAndStaffTypeAndIsActiveTrue(
                                                        booking.getGarageId(),
                                                        staffType);

                        int assigned = 0;

                        for (StaffProfile staffProfile : staffs) {

                                if (assigned >= servicePackage.getCareStaffRequiredCount()) {
                                        break;
                                }
                                long overlap = bookingAssignedStaffRepository
                                                .countOverlap(
                                                                staffProfile.getId(),
                                                                booking.getStartTime(),
                                                                booking.getEndTime());

                                if (overlap > 0) {
                                        continue;
                                }

                                BookingAssignedStaff bas = new BookingAssignedStaff();

                                bas.setBookingId(booking.getId());
                                bas.setStaffProfileId(staffProfile.getId());
                                bas.setAssignedFrom(booking.getStartTime());
                                bas.setAssignedTo(booking.getEndTime());
                                bas.setRoleInBooking(servicePackage.getCareStaffType());

                                bookingAssignedStaffRepository.save(bas);

                                assigned++;
                        }

                        if (assigned < servicePackage.getCareStaffRequiredCount()) {

                                throw new ResponseStatusException(
                                                HttpStatus.BAD_REQUEST,
                                                "Not enough care staff");
                        }
                }

                // ================= Generate Booking Service Steps =================
                // For a COMBO package, this resolves to its included MAIN + ADD_ON steps.
                List<ServicePackageStep> mainTemplates = comboStepResolver.resolveSteps(servicePackage);

                List<ServicePackageStep> addOnTemplates = new ArrayList<>();
                for (Long addOnId : getBookingAddOnIds(booking.getId())) {
                        addOnTemplates.addAll(
                                        servicePackageStepRepository.findByServicePackage_IdOrderByStepOrder(
                                                        addOnId));
                }

                // Main steps first, then add-on steps after.
                List<ServicePackageStep> orderedTemplates = new ArrayList<>();
                orderedTemplates.addAll(mainTemplates);
                orderedTemplates.addAll(addOnTemplates);

                int stepOrder = 1;
                for (ServicePackageStep template : orderedTemplates) {

                        BookingServiceStep step = new BookingServiceStep();

                        step.setBookingId(booking.getId());

                        step.setServicePackageId(template.getServicePackage().getId());

                        step.setServicePackageStepId(template.getId());

                        step.setStepOrder(stepOrder++);

                        step.setName(template.getName());

                        step.setDescription(template.getDescription());

                        step.setStatus("PENDING");

                        step.setExecutionPhase(template.getExecutionPhase());
                        step.setDurationMinutes(template.getDurationMinutes());

                        bookingServiceStepRepository.save(step);
                }

                // ================= Update Booking =================
                booking.setStatus("IN_PROGRESS");
                booking.setOperationPhase("AUTOMATED_WASH");

                booking.setStartedAt(startedAt);

                if (request.getNote() != null
                                && !request.getNote().isBlank()) {

                        booking.setNote(request.getNote());
                }

                Booking saved = bookingRepository.save(booking);

                BookingResponse response = toResponse(saved);

                response.setAssignedCareStaffIds(resolveAssignedCareStaffIds(saved.getId()));

                return response;
        }
        // ===================== ISSUE #19 =====================

        @Override
        @Transactional
        public BookingResponse cancelBooking(Long bookingId, Long currentUserId, String role, String reason) {

                Booking booking = bookingRepository.findById(bookingId)
                                .orElseThrow(() -> new ResponseStatusException(
                                                HttpStatus.NOT_FOUND,
                                                "Booking not found: " + bookingId));

                String status = booking.getStatus();

                if ("ROLE_CUSTOMER".equals(role)) {

                        if (!currentUserId.equals(booking.getCustomerId())) {
                                throw new ResponseStatusException(
                                                HttpStatus.FORBIDDEN,
                                                "You can only cancel your own bookings");
                        }

                        if (!"CONFIRMED".equals(status)
                                        && !"PENDING_DEPOSIT".equals(status)) {

                                throw new ResponseStatusException(
                                                HttpStatus.BAD_REQUEST,
                                                "Customer can only cancel booking before check-in. Current status: "
                                                                + status);
                        }

                } else {

                        staffOperationAccessPolicy.requireCustomerServiceOrAdminForGarage(currentUserId, role, booking.getGarageId());

                        if (!"CONFIRMED".equals(status)
                                        && !"CHECKED_IN".equals(status)
                                        && !"PENDING_DEPOSIT".equals(status)) {

                                throw new ResponseStatusException(
                                                HttpStatus.BAD_REQUEST,
                                                "Cannot cancel booking with status: " + status);
                        }
                }

                releaseBookingResources(booking);

                BigDecimal refundAmount = calculateRefundAmount(
                                booking,
                                role);

                booking.setRefundAmount(refundAmount);

                booking.setStatus("CANCELED");

                boolean depositWasPaid = "PAID".equals(booking.getDepositStatus());

                if (depositWasPaid && refundAmount.compareTo(BigDecimal.ZERO) > 0) {

                        booking.setDepositStatus("REFUND_PENDING");

                } else if (depositWasPaid) {

                        booking.setDepositStatus("FORFEITED");

                } else {

                        // A configured deposit amount is not money received. An unpaid
                        // booking must never enter the refund workflow.
                        booking.setDepositStatus("CANCELED");

                }

                if ("PENDING_DEPOSIT".equals(status)) {

                        booking.setPaymentStatus("CANCELED");

                }

                booking.setNote(reason != null ? reason : booking.getNote());

                booking.setRewardProcessed(false);

                Booking saved = bookingRepository.save(booking);

                notificationService.notifyBookingCanceled(saved.getId());
                // Hoàn điểm nếu có — không hoàn khi đã CHECKED_IN (điểm bị giữ làm phí)
                if (!"CHECKED_IN".equals(status)) {
                        loyaltyService.refundPointsForCanceledBooking(saved.getId());
                }

                // Trả lại promotion khi hủy booking
                if (saved.getPromotionId() != null) {
                        promotionUsageRepository.findByBookingId(saved.getId()).ifPresent(usage -> {
                                promotionUsageRepository.delete(usage);
                                promotionRepository.findById(saved.getPromotionId()).ifPresent(p -> {
                                        p.setUsedCount(Math.max(0, p.getUsedCount() - 1));
                                        promotionRepository.save(p);
                                });
                        });
                }

                return toResponse(saved);
        }

        @Override
        @Transactional
        public BookingResponse markNoShow(Long bookingId, Long staffUserId, String role, String reason) {

                Booking booking = bookingRepository.findById(bookingId)
                                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                                                "Booking not found: " + bookingId));

                staffOperationAccessPolicy.requireCustomerServiceOrAdminForGarage(staffUserId, role, booking.getGarageId());

                if (!"CONFIRMED".equals(booking.getStatus())) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                                        "Can only mark no-show for CONFIRMED bookings. Current status: "
                                                        + booking.getStatus());
                }

                if (booking.getWashBayId() != null) {
                        washBayRepository.findById(booking.getWashBayId()).ifPresent(washBay -> {
                                washBay.setStatus(WashBayStatus.AVAILABLE);
                                washBay.setCurrentBookingId(null);
                                washBayRepository.save(washBay);
                        });
                        booking.setWashBayId(null);
                }

                List<BookingAssignedStaff> assignedStaffs = bookingAssignedStaffRepository
                                .findByBookingId(bookingId);
                for (BookingAssignedStaff assignedStaff : assignedStaffs) {
                        assignedStaff.setStatus("CANCELED");
                        bookingAssignedStaffRepository.save(assignedStaff);
                }

                booking.setStatus("NO_SHOW");
                booking.setNote(reason != null ? reason : booking.getNote());
                booking.setRewardProcessed(false);

                Booking saved = bookingRepository.save(booking);
                // Trả lại promotion khi no-show
                if (saved.getPromotionId() != null) {
                        promotionUsageRepository.findByBookingId(saved.getId()).ifPresent(usage -> {
                                promotionUsageRepository.delete(usage);
                                promotionRepository.findById(saved.getPromotionId()).ifPresent(p -> {
                                        p.setUsedCount(Math.max(0, p.getUsedCount() - 1));
                                        promotionRepository.save(p);
                                });
                        });
                }
                return toResponse(saved);
        }

        @Override
        @Transactional
        public BookingResponse completeManualRefund(
                        Long bookingId,
                        Long staffUserId,
                        String role,
                        String note) {

                Booking booking = bookingRepository.findById(bookingId)
                                .orElseThrow(() -> new ResponseStatusException(
                                                HttpStatus.NOT_FOUND,
                                                "Booking not found"));

                staffOperationAccessPolicy.requireCustomerServiceOrAdminForGarage(staffUserId, role, booking.getGarageId());

                if (booking.getCustomerId() != null) {
                        throw new ResponseStatusException(
                                        HttpStatus.CONFLICT,
                                        "Registered-customer refunds must be completed through the Deposit Refund workflow");
                }

                if (!"REFUND_PENDING".equals(
                                booking.getDepositStatus())) {

                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "Booking is not waiting for manual refund");

                }

                booking.setDepositStatus("REFUNDED");

                booking.setNote(
                                note != null && !note.isBlank()
                                                ? note
                                                : booking.getNote());

                Booking saved = bookingRepository.save(booking);

                return toResponse(saved);
        }

        @Override
        @Transactional
        public void expirePendingDeposits() {

                List<Booking> bookings = bookingRepository.findExpiredPendingDeposits(
                                LocalDateTime.now());

                for (Booking booking : bookings) {
                        try {
                                expireOneDepositBooking(booking);
                        } catch (Exception ex) {
                                log.error("[DEPOSIT_SCHEDULER] Failed to expire booking #{}: {}",
                                                booking.getId(), ex.getMessage());
                        }
                }

        }

        private void expireOneDepositBooking(Booking booking) {

                // Idempotency: skip if already processed (race with PayOS webhook)
                if (!"PENDING_DEPOSIT".equals(booking.getStatus())) return;
                if ("PAID".equals(booking.getDepositStatus())
                                || "REFUND_PENDING".equals(booking.getDepositStatus())
                                || "REFUNDED".equals(booking.getDepositStatus())) return;

                releaseBookingResources(booking);

                booking.setStatus("CANCELED");
                booking.setPaymentStatus("EXPIRED");
                booking.setDepositStatus("UNPAID");
                booking.setNote("Deposit payment expired");
                bookingRepository.save(booking);

                // Cancel ALL pending deposit transactions (not just the first one)
                paymentTransactionRepository
                                .findByBookingIdAndPurposeOrderByCreatedAtDesc(
                                                booking.getId(), "DEPOSIT")
                                .stream()
                                .filter(tx -> "PENDING".equals(tx.getStatus()))
                                .forEach(tx -> {
                                        tx.setStatus("EXPIRED");
                                        tx.setCancelReason("Payment timeout");
                                        paymentTransactionRepository.save(tx);
                                });

                notificationService.notifyBookingCanceled(booking.getId());

        }
        // ===================== ISSUE #17 =====================

        @Override
        public List<BookingServiceStepResponse> getBookingServiceSteps(
                        Long bookingId,
                        Long currentUserId,
                        String role) {

                Booking booking = bookingRepository.findById(bookingId)
                                .orElseThrow(() -> new ResponseStatusException(
                                                HttpStatus.NOT_FOUND,
                                                "Booking not found"));

                // CUSTOMER
                if ("CUSTOMER".equalsIgnoreCase(role)) {

                        if (!booking.getCustomerId().equals(currentUserId)) {
                                throw new ResponseStatusException(
                                                HttpStatus.FORBIDDEN,
                                                "You cannot access this booking");
                        }
                }

                // STAFF — explicit allow-list: only CUSTOMER_SERVICE_STAFF may read booking service steps.
                // VEHICLE_CARE_STAFF and other staff types use their own care-task endpoints.
                if ("STAFF".equalsIgnoreCase(role)) {

                        StaffProfile staffProfile = staffProfileRepository
                                        .findByUser_Id(currentUserId)
                                        .orElseThrow(() -> new ResponseStatusException(
                                                        HttpStatus.FORBIDDEN,
                                                        "Staff profile not found"));

                        if (!Boolean.TRUE.equals(staffProfile.getIsActive())) {
                                throw new ResponseStatusException(
                                                HttpStatus.FORBIDDEN,
                                                "Staff profile is inactive");
                        }

                        if (staffProfile.getStaffType() != StaffType.CUSTOMER_SERVICE_STAFF) {
                                throw new ResponseStatusException(
                                                HttpStatus.FORBIDDEN,
                                                "Only CUSTOMER_SERVICE_STAFF can access booking service steps");
                        }

                        if (!staffProfile.getGarageId().equals(booking.getGarageId())) {
                                throw new ResponseStatusException(
                                                HttpStatus.FORBIDDEN,
                                                "You cannot access booking from another garage");
                        }
                }

                List<BookingServiceStep> steps = bookingServiceStepRepository
                                .findByBookingIdOrderByStepOrder(bookingId);

                return steps.stream()
                                .map(this::toServiceStepResponse)
                                .toList();
        }

        // ===================== ISSUE #18 =====================

        @Override
        @Transactional
        public BookingResponse completeService(Long bookingId, Long staffUserId, String role, String note) {

                // 1. Validate booking
                Booking booking = bookingRepository.findById(bookingId)
                                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                                                "Booking not found: " + bookingId));

                // 2. Validate garage permission — ADMIN bypass + CSS type check
                staffOperationAccessPolicy.requireCustomerServiceOrAdminForGarage(staffUserId, role, booking.getGarageId());

                // 3. Validate status
                if (!"IN_PROGRESS".equals(booking.getStatus())) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                                        "Only IN_PROGRESS booking can be completed. Current status: "
                                                        + booking.getStatus());
                }

                // 3a. Validate all service steps are completed
                validateAllStepsCompleted(bookingId);

                // 3b. Validate operation phase (fail-closed — prevents bypassing care workflow)
                validateCompleteServicePhase(booking);

                // 3c. Validate required inspections exist (kiểm tra / bàn giao are fixed
                // booking-level steps, not service-package steps — "bàn giao" is this
                // completeService action itself, so it must be preceded by the
                // required VehicleInspection records)
                requireInspectionsBeforeCompletion(booking);

                LocalDateTime completedAt = LocalDateTime.now();

                // 4. Release wash bay only when this booking still owns it (safety check prevents
                // corrupting another booking's resource in the rare event of an ID mismatch)
                if (booking.getWashBayId() != null) {
                        washBayRepository.findById(booking.getWashBayId()).ifPresent(washBay -> {
                                Long currentOwner = washBay.getCurrentBookingId();
                                if (currentOwner != null && !currentOwner.equals(booking.getId())) {
                                        log.warn("[WASH_BAY_MISMATCH] Booking {} completing: washBay {} owned by booking {}. Skipping release.",
                                                        booking.getId(), washBay.getId(), currentOwner);
                                        return;
                                }
                                washBay.setStatus(WashBayStatus.AVAILABLE);
                                washBay.setCurrentBookingId(null);
                                washBayRepository.save(washBay);
                        });
                        booking.setWashBayEndTime(completedAt);
                }

                // 5. Release only active/reserved/assigned care staff
                List<BookingAssignedStaff> assignedStaffs = bookingAssignedStaffRepository
                                .findByBookingId(bookingId);
                for (BookingAssignedStaff assignedStaff : assignedStaffs) {
                        String s = assignedStaff.getStatus();
                        if ("ACTIVE".equals(s) || "RESERVED".equals(s) || "ASSIGNED".equals(s)) {
                                assignedStaff.setStatus("RELEASED");
                                bookingAssignedStaffRepository.save(assignedStaff);
                        }
                }

                // 6. Update booking
                booking.setStatus("COMPLETED");
                booking.setOperationPhase("DONE");
                booking.setCompletedAt(completedAt);
                booking.setRewardProcessed(false);
                if (note != null && !note.isBlank()) {
                        booking.setNote(note);
                }

                Booking saved = bookingRepository.save(booking);

                try {
                        bookingReviewService.maybeCreateReviewRequestNotification(saved.getId());
                } catch (Exception e) {
                        log.warn("Failed to send review request notification for booking {}: {}", saved.getId(), e.getMessage());
                }

                return toResponse(saved);
        }

        private void requireInspectionsBeforeCompletion(Booking booking) {
                List<VehicleInspection> inspections = vehicleInspectionRepository
                                .findByBookingIdOrderByCreatedAtAsc(booking.getId());

                boolean hasBeforeWash = inspections.stream()
                                .anyMatch(inspection -> "BEFORE_WASH".equals(inspection.getType()));

                if (!hasBeforeWash) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                                        "BEFORE_WASH inspection is required before completing this booking");
                }

                if (requiresAfterWashInspection(booking)) {
                        VehicleInspection afterWash = inspections.stream()
                                        .filter(inspection -> "AFTER_WASH".equals(inspection.getType()))
                                        .reduce((first, second) -> second)
                                        .orElse(null);

                        if (afterWash == null) {
                                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                                                "AFTER_WASH inspection is required before completing this booking");
                        }

                        // A recovered legacy booking may contain an AFTER_WASH inspection that
                        // was recorded before its care work actually finished. Require staff to
                        // update/reconfirm it after completeCare so stale evidence cannot pass.
                        LocalDateTime inspectedAt = afterWash.getUpdatedAt() != null
                                        ? afterWash.getUpdatedAt()
                                        : afterWash.getCreatedAt();
                        if (booking.getCareCompletedAt() != null && inspectedAt != null
                                        && inspectedAt.isBefore(booking.getCareCompletedAt())) {
                                throw new ResponseStatusException(HttpStatus.CONFLICT,
                                                "AFTER_WASH inspection must be created or updated after Vehicle Care is completed");
                        }
                }
        }

        /** Rejects if any BookingServiceStep for this booking is not yet COMPLETED. */
        private void validateAllStepsCompleted(Long bookingId) {
                List<BookingServiceStep> steps = bookingServiceStepRepository
                                .findByBookingIdOrderByStepOrder(bookingId);
                if (steps == null || steps.isEmpty()) return;
                long incomplete = steps.stream()
                                .filter(s -> !"COMPLETED".equals(s.getStatus()))
                                .count();
                if (incomplete > 0) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                                        "All service steps must be completed before finishing the booking. "
                                                        + incomplete + " step(s) still incomplete.");
                }
        }

        /**
         * Rejects if the requested phase has no configured steps, contains incomplete
         * steps, or the booking still has an unclassified pending step. This is
         * intentionally fail-closed so a resource is never released on bad configuration.
         * Callers: completeCare (VEHICLE_CARE), completeWash (AUTOMATED_WASH).
         */
        private void validatePhaseStepsCompleted(Long bookingId, String executionPhase) {
                List<BookingServiceStep> loadedSteps = bookingServiceStepRepository
                                .findByBookingIdOrderByStepOrder(bookingId);
                List<BookingServiceStep> steps = loadedSteps == null ? List.of() : loadedSteps;

                List<String> unclassifiedPending = steps.stream()
                                .filter(s -> s.getExecutionPhase() == null || s.getExecutionPhase().isBlank())
                                .filter(s -> !"COMPLETED".equals(s.getStatus()))
                                .map(s -> s.getName() != null ? s.getName() : "step #" + s.getId())
                                .toList();
                if (!unclassifiedPending.isEmpty()) {
                        throw new ResponseStatusException(HttpStatus.CONFLICT,
                                        "Cannot advance " + executionPhase
                                                        + ": pending service step(s) have no execution phase: "
                                                        + String.join(", ", unclassifiedPending));
                }

                List<BookingServiceStep> phaseSteps = steps.stream()
                                .filter(s -> executionPhase.equalsIgnoreCase(s.getExecutionPhase()))
                                .toList();

                // Fail closed. Advancing a resource phase without any phase-owned step would
                // silently release the bay/staff for a misconfigured or legacy package.
                if (phaseSteps.isEmpty()) {
                        throw new ResponseStatusException(HttpStatus.CONFLICT,
                                        "Cannot advance " + executionPhase
                                                        + ": no service steps are configured for this phase. "
                                                        + "Fix the package/booking step configuration first.");
                }

                List<String> incomplete = phaseSteps.stream()
                                .filter(s -> !"COMPLETED".equals(s.getStatus()))
                                .map(s -> s.getName() != null ? s.getName() : "step #" + s.getId())
                                .toList();
                if (!incomplete.isEmpty()) {
                        throw new ResponseStatusException(HttpStatus.CONFLICT,
                                        "All " + executionPhase + " steps must be completed before advancing. "
                                                        + incomplete.size() + " step(s) still incomplete: "
                                                        + String.join(", ", incomplete));
                }
        }

        /**
         * For care bookings: rejects if the AFTER_WASH inspection was recorded BEFORE care was completed.
         * Staff must reconfirm the vehicle's final condition after care finishes.
         * No-care bookings skip this check (no careCompletedAt).
         */
        private void requireFreshAfterWashInspection(Booking booking) {
                if (booking.getCareCompletedAt() == null || !requiresAfterWashInspection(booking)) {
                        return;
                }
                vehicleInspectionRepository.findByBookingIdOrderByCreatedAtAsc(booking.getId())
                                .stream()
                                .filter(i -> "AFTER_WASH".equals(i.getType()))
                                .findFirst()
                                .ifPresent(afterWash -> {
                                        LocalDateTime inspTime = afterWash.getUpdatedAt() != null
                                                        ? afterWash.getUpdatedAt()
                                                        : afterWash.getCreatedAt();
                                        if (inspTime != null && inspTime.isBefore(booking.getCareCompletedAt())) {
                                                throw new ResponseStatusException(HttpStatus.CONFLICT,
                                                                "AFTER_WASH inspection is stale — it was recorded before Vehicle Care was completed. "
                                                                + "Review the vehicle's final condition and reconfirm the inspection before completing final inspection.");
                                        }
                                });
        }

        /**
         * Fail-closed operationPhase guard for completeService.
         * All bookings must be at READY_FOR_HANDOVER.
         * Care bookings must first advance via completeFinalInspection (FINAL_INSPECTION → READY_FOR_HANDOVER).
         * No-care bookings: READY_FOR_HANDOVER or legacy null phase are valid.
         */
        private void validateCompleteServicePhase(Booking booking) {
                ServicePackage mainPkg = servicePackageRepository.findById(booking.getServicePackageId()).orElse(null);
                List<ServicePackage> allPackages = buildAllPackagesForBooking(booking, mainPkg);
                ResourceWindows rw = computeResourceWindows(allPackages);

                String currentPhase = booking.getOperationPhase();
                boolean hasPhase = currentPhase != null && !currentPhase.isBlank();

                if ("READY_FOR_HANDOVER".equals(currentPhase)) {
                        return; // valid for all booking types
                }
                if (!rw.requiresCareStaff && !hasPhase) {
                        return; // legacy no-phase no-care booking
                }

                if (rw.requiresCareStaff) {
                        if ("FINAL_INSPECTION".equals(currentPhase)) {
                                throw new ResponseStatusException(HttpStatus.CONFLICT,
                                                "Booking " + booking.getId() + " is at FINAL_INSPECTION. "
                                                + "Call PATCH /bookings/" + booking.getId()
                                                + "/operations/complete-final-inspection first "
                                                + "to advance to READY_FOR_HANDOVER, then complete handover.");
                        }
                        throw new ResponseStatusException(HttpStatus.CONFLICT,
                                        "Cannot complete care-required booking from phase: "
                                                        + (currentPhase != null ? currentPhase : "null")
                                                        + ". Required workflow: VEHICLE_CARE → FINAL_INSPECTION → READY_FOR_HANDOVER.");
                } else {
                        if ("FINAL_INSPECTION".equals(currentPhase)) {
                                throw new ResponseStatusException(HttpStatus.CONFLICT,
                                                "Booking " + booking.getId() + " is at FINAL_INSPECTION. "
                                                + "Call PATCH /bookings/" + booking.getId()
                                                + "/operations/complete-final-inspection first "
                                                + "to advance to READY_FOR_HANDOVER, then complete handover.");
                        }
                        throw new ResponseStatusException(HttpStatus.CONFLICT,
                                        "Cannot complete no-care booking from phase: " + currentPhase
                                                        + ". Expected: READY_FOR_HANDOVER");
                }
        }

        private boolean requiresAfterWashInspection(Booking booking) {
                // Bookings with planned care always need AFTER_WASH inspection
                if (booking.getPlannedCareStartAt() != null) {
                        return true;
                }
                // Use canonical resource resolver — only packages that actually require care staff
                // need an AFTER_WASH inspection, not any package that happens to be an ADD_ON or COMBO.
                ServicePackage mainPkg = servicePackageRepository.findById(booking.getServicePackageId()).orElse(null);
                List<ServicePackage> allPackages = buildAllPackagesForBooking(booking, mainPkg);
                ResourceWindows rw = computeResourceWindows(allPackages);
                return rw.requiresCareStaff;
        }

        /**
         * Recovery endpoint for bookings that were incorrectly placed in READY_FOR_HANDOVER
         * despite requiring care staff (caused by the historical COMBO resource-aggregation bug).
         * Moves the booking back to WAITING_FOR_CARE, computes care windows if missing, and
         * reserves care staff (idempotent — will not create duplicate assignments).
         * Safe to run multiple times.
         */
        @Override
        @Transactional
        public BookingResponse recoverCareWorkflow(Long bookingId, Long staffUserId, String role) {
                Booking booking = bookingRepository.findById(bookingId)
                                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                                                "Booking not found: " + bookingId));

                staffOperationAccessPolicy.requireCustomerServiceOrAdminForGarage(staffUserId, role, booking.getGarageId());

                String bStatus = booking.getStatus();
                if ("COMPLETED".equals(bStatus) || "CANCELED".equals(bStatus)
                                || "CANCELLED".equals(bStatus) || "NO_SHOW".equals(bStatus)) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                                        "Cannot recover a " + bStatus + " booking.");
                }
                if (!"IN_PROGRESS".equals(bStatus) && !"CHECKED_IN".equals(bStatus)) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                                        "Recovery only applies to IN_PROGRESS or CHECKED_IN bookings. Current: " + bStatus);
                }
                String currentPhase = booking.getOperationPhase();
                if (!"FINAL_INSPECTION".equals(currentPhase) && !"READY_FOR_HANDOVER".equals(currentPhase)) {
                        throw new ResponseStatusException(HttpStatus.CONFLICT,
                                        "Care recovery is only allowed after a booking skipped Vehicle Care. Current phase: "
                                                        + currentPhase);
                }

                ServicePackage mainPkg = servicePackageRepository.findById(booking.getServicePackageId()).orElse(null);
                List<ServicePackage> allPackages = buildAllPackagesForBooking(booking, mainPkg);
                ResourceWindows rw = computeResourceWindows(allPackages);

                if (!rw.requiresCareStaff) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                                        "Booking " + bookingId + " does not require care staff per canonical resolver. "
                                                        + "No recovery needed.");
                }

                LocalDateTime careStart = booking.getPlannedCareStartAt();
                LocalDateTime careEnd = booking.getPlannedCareEndAt();
                LocalDateTime now = LocalDateTime.now();

                if (careStart == null) {
                        careStart = booking.getPlannedWashEndAt() != null ? booking.getPlannedWashEndAt() : now;
                }
                if (careEnd == null || !careEnd.isAfter(careStart)) {
                        careEnd = careStart.plusMinutes(rw.totalCareMinutes > 0 ? rw.totalCareMinutes : 60);
                        log.warn("[CARE_RECOVERY] Booking {} care window was null; set to {} – {}.",
                                        bookingId, careStart, careEnd);
                }
                booking.setPlannedCareStartAt(careStart);
                booking.setPlannedCareEndAt(careEnd);

                booking.setOperationPhase("WAITING_FOR_CARE");
                booking.setCareStartedAt(null);
                booking.setCareCompletedAt(null);

                // A historically premature completeCare leaves RELEASED assignments behind.
                // Re-open those rows as CANCELED so reservation can safely reuse the existing
                // (booking_id, staff_profile_id) row instead of violating the unique key.
                bookingAssignedStaffRepository.findByBookingId(bookingId).stream()
                                .filter(a -> "VEHICLE_CARE_STAFF".equals(a.getRoleInBooking()))
                                .filter(a -> "RELEASED".equals(a.getStatus()))
                                .forEach(a -> {
                                        a.setStatus("CANCELED");
                                        bookingAssignedStaffRepository.save(a);
                                });
                Booking saved = bookingRepository.save(booking);

                // reserveCareStaff is already idempotent: skips if an active assignment exists
                reserveCareStaff(saved, rw, careStart, careEnd);

                log.warn("[CARE_RECOVERY] Booking {} recovered → WAITING_FOR_CARE. Care staff reservation attempted.",
                                bookingId);
                return toResponse(saved);
        }

        @Override
        public BookingServiceStepResponse completeServiceStep(
                        Long stepId,
                        Long staffUserId,
                        String role,
                        CompleteBookingServiceStepRequest request) {

                BookingServiceStep step = bookingServiceStepRepository
                                .findById(stepId)
                                .orElseThrow(() -> new ResponseStatusException(
                                                HttpStatus.NOT_FOUND,
                                                "Service step not found"));

                Booking booking = bookingRepository
                                .findById(step.getBookingId())
                                .orElseThrow(() -> new ResponseStatusException(
                                                HttpStatus.NOT_FOUND,
                                                "Booking not found"));

                staffOperationAccessPolicy.requireCustomerServiceOrAdminForGarage(staffUserId, role, booking.getGarageId());

                if (!"IN_PROGRESS".equals(booking.getStatus())) {

                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "Service has not started");
                }

                if ("COMPLETED".equals(step.getStatus())) {

                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "Service step already completed");
                }

                // Issue #19: A step may only be completed in the matching operation phase
                if (step.getExecutionPhase() != null && !step.getExecutionPhase().isBlank()
                                && booking.getOperationPhase() != null
                                && !step.getExecutionPhase().equalsIgnoreCase(booking.getOperationPhase())) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                                        "Step belongs to phase " + step.getExecutionPhase()
                                                        + " but booking is currently in phase "
                                                        + booking.getOperationPhase());
                }

                step.setStatus("COMPLETED");

                step.setCompletedAt(LocalDateTime.now());

                step.setCompletedByStaffId(staffUserId);

                BookingServiceStep saved = bookingServiceStepRepository.save(step);

                return toServiceStepResponse(saved);
        }

        @Override
        public BookingServiceStepResponse reopenServiceStep(
                        Long stepId,
                        Long staffUserId,
                        String role,
                        ReopenBookingServiceStepRequest request) {

                BookingServiceStep step = bookingServiceStepRepository
                                .findById(stepId)
                                .orElseThrow(() -> new ResponseStatusException(
                                                HttpStatus.NOT_FOUND,
                                                "Service step not found"));

                Booking booking = bookingRepository
                                .findById(step.getBookingId())
                                .orElseThrow(() -> new ResponseStatusException(
                                                HttpStatus.NOT_FOUND,
                                                "Booking not found"));

                staffOperationAccessPolicy.requireCustomerServiceOrAdminForGarage(staffUserId, role, booking.getGarageId());

                if (!"IN_PROGRESS".equals(booking.getStatus())) {

                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "Service has not started");
                }

                if (!"COMPLETED".equals(step.getStatus())) {

                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "Service step is not completed");
                }

                step.setStatus("PENDING");

                step.setCompletedAt(null);

                step.setCompletedByStaffId(null);

                // Save
                BookingServiceStep saved = bookingServiceStepRepository.save(step);

                return toServiceStepResponse(saved);
        }

        @Override
        @Transactional
        public BookingResponse markBookingPaid(
                        Long bookingId,
                        Long staffUserId,
                        String role,
                        MarkBookingPaidRequest request) {

                Booking booking = bookingRepository
                                .findById(bookingId)
                                .orElseThrow(() -> new ResponseStatusException(
                                                HttpStatus.NOT_FOUND,
                                                "Booking not found"));

                staffOperationAccessPolicy.requireCustomerServiceOrAdminForGarage(staffUserId, role, booking.getGarageId());

                if (!"COMPLETED".equals(booking.getStatus())) {

                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "Only completed booking can be marked as paid");
                }

                if ("PAID".equals(booking.getPaymentStatus())) {

                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "Booking already paid");
                }

                if (!"CASH".equalsIgnoreCase(request.getPaymentMethod())) {

                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "Only CASH payment is supported");
                }

                booking.setPaymentStatus("PAID");

                booking.setPaymentMethod(request.getPaymentMethod().toUpperCase());

                booking.setPaidAt(LocalDateTime.now());

                if (request.getNote() != null
                                && !request.getNote().isBlank()) {

                        booking.setNote(request.getNote());
                }

                Booking saved = bookingRepository.save(booking);

                loyaltyService.updateBookingStatistics(saved.getId());
                promotionService.recordPromotionUsageAfterPaidBooking(saved.getId());
                loyaltyService.earnPointsAfterPaidBooking(saved.getId());
                washHistoryService.createWashHistoryAfterPaidBooking(saved.getId());
                notificationService.notifyPaymentAndReward(saved.getId());
                try {
                        bookingReviewService.maybeCreateReviewRequestNotification(saved.getId());
                } catch (Exception e) {
                        log.warn("Failed to send review request notification for booking {}: {}", saved.getId(), e.getMessage());
                }
                return toResponse(saved);
        }
        // ===================== UPDATE PAYMENT METHOD =====================

        @Override
        @Transactional
        public BookingResponse updatePaymentMethod(
                        Long bookingId,
                        Long staffUserId,
                        String role,
                        UpdatePaymentMethodRequest request) {

                Booking booking = bookingRepository
                                .findById(bookingId)
                                .orElseThrow(() -> new ResponseStatusException(
                                                HttpStatus.NOT_FOUND,
                                                "Booking not found"));

                staffOperationAccessPolicy.requireCustomerServiceOrAdminForGarage(staffUserId, role, booking.getGarageId());

                String normalized = request.getPaymentMethod().trim().toUpperCase();
                if (!normalized.equals("CASH") && !normalized.equals("PAYOS") && !normalized.equals("BANK_TRANSFER")) {
                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "Unsupported payment method: " + request.getPaymentMethod());
                }

                String stored = normalized.equals("BANK_TRANSFER") ? "PAYOS" : normalized;
                booking.setPaymentMethod(stored);

                Booking saved = bookingRepository.save(booking);
                return toResponse(saved);
        }

        // ===================== HELPER =====================

        private User findActiveCustomerByPhone(String phone) {
                String normalizedPhone = VietnamesePhoneNumber.normalizeMobile(phone);

                return userRepository.findByPhone(normalizedPhone)
                                .filter(user -> Boolean.TRUE.equals(user.getIsActive()))
                                .filter(user -> "CUSTOMER".equalsIgnoreCase(user.getRole()))
                                .orElse(null);
        }

        private String normalizeWalkInPaymentMethod(String paymentMethod) {
                if (paymentMethod == null || paymentMethod.isBlank()) {
                        return null;
                }

                String normalized = paymentMethod.trim().toUpperCase();
                if ("BANK_TRANSFER".equals(normalized) || "TRANSFER".equals(normalized) || "QR".equals(normalized)) {
                        return "PAYOS";
                }
                if ("PAYOS".equals(normalized) || "CASH".equals(normalized)) {
                        return normalized;
                }

                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                                "Unsupported walk-in payment method: " + paymentMethod);
        }

        private Vehicle findMatchedCustomerVehicle(
                        User customer,
                        String normalizedPlate,
                        String vehicleType) {
                if (customer == null || normalizedPlate == null || vehicleType == null) {
                        return null;
                }

                return vehicleRepository
                                .findByCustomer_IdAndNormalizedLicensePlateAndVehicleTypeAndIsActiveTrue(
                                                customer.getId(),
                                                normalizedPlate,
                                                vehicleType)
                                .orElse(null);
        }

        private void assertLicensePlateAvailable(String normalizedPlate, String vehicleType) {
                if (vehicleRepository.existsByNormalizedLicensePlateAndVehicleType(
                                normalizedPlate, vehicleType)) {
                        throw new ResponseStatusException(HttpStatus.CONFLICT,
                                        "License plate already exists: " + normalizedPlate);
                }
        }

        private boolean isGarageFaultCancellation(String role) {

                return "ROLE_ADMIN".equals(role)
                                || "ROLE_STAFF".equals(role);

        }

        private boolean isGracePeriod(Booking booking) {

                LocalDateTime now = LocalDateTime.now();

                long minutesFromCreated = java.time.Duration.between(
                                booking.getCreatedAt(),
                                now)
                                .toMinutes();

                long hoursBeforeService = java.time.Duration.between(
                                now,
                                booking.getStartTime())
                                .toHours();

                return minutesFromCreated <= GRACE_PERIOD_MINUTES
                                && hoursBeforeService >= GRACE_MIN_HOURS_BEFORE_SERVICE;

        }

        private BigDecimal calculateRefundPercentage(
                        LocalDateTime cancelTime,
                        LocalDateTime startTime) {

                long hours = java.time.Duration
                                .between(cancelTime, startTime)
                                .toHours();

                if (hours >= REFUND_RULE_24_HOURS) {

                        return REFUND_PERCENT_100;

                }

                if (hours >= REFUND_RULE_12_HOURS) {

                        return REFUND_PERCENT_80;

                }

                if (hours >= REFUND_RULE_6_HOURS) {

                        return REFUND_PERCENT_50;

                }

                return REFUND_PERCENT_0;

        }

        // ===================== TASK 4: Cancellation Preview =====================

        @Override
        @Transactional(readOnly = true)
        public CancellationPreviewResponse getCancellationPreview(Long bookingId, Long customerId) {
                Booking booking = bookingRepository.findById(bookingId)
                                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                                                "Booking not found: " + bookingId));

                if (!customerId.equals(booking.getCustomerId())) {
                        throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                                        "You can only preview cancellation for your own bookings");
                }

                // customerBookingNumber
                Integer customerBookingNumber = null;
                if (booking.getCustomerId() != null && booking.getId() != null) {
                        long pos = bookingRepository.countByCustomerIdAndIdLessThanEqual(booking.getCustomerId(), booking.getId());
                        if (pos > 0) customerBookingNumber = (int) pos;
                }

                boolean depositPaid = "PAID".equals(booking.getDepositStatus());
                BigDecimal depositAmount = booking.getDepositAmount() != null ? booking.getDepositAmount() : BigDecimal.ZERO;

                if (!depositPaid || depositAmount.compareTo(BigDecimal.ZERO) <= 0) {
                        return CancellationPreviewResponse.builder()
                                        .bookingId(bookingId)
                                        .customerBookingNumber(customerBookingNumber)
                                        .depositPaid(depositPaid)
                                        .depositAmount(depositAmount)
                                        .refundPercentage(0)
                                        .refundAmount(BigDecimal.ZERO)
                                        .eligibleForRefund(false)
                                        .ruleCode("NO_DEPOSIT")
                                        .message(depositPaid
                                                ? "No deposit amount was set for this booking."
                                                : "Deposit has not been paid — no refund applicable.")
                                        .build();
                }

                // Determine rule (customer-initiated cancellation — role = CUSTOMER)
                BigDecimal refundAmount;
                String ruleCode;
                String message;
                int refundPercentage;

                if (isGracePeriod(booking)) {
                        refundAmount = depositAmount;
                        refundPercentage = 100;
                        ruleCode = "GRACE_PERIOD";
                        message = "You are within the 30-minute grace period — 100% refund applies.";
                } else {
                        BigDecimal percent = calculateRefundPercentage(LocalDateTime.now(), booking.getStartTime());
                        refundAmount = depositAmount.multiply(percent).setScale(2, RoundingMode.HALF_UP);

                        if (REFUND_PERCENT_100.compareTo(percent) == 0) {
                                refundPercentage = 100;
                                ruleCode = "FULL_REFUND";
                                message = "More than 24 hours before service — 100% refund applies.";
                        } else if (REFUND_PERCENT_80.compareTo(percent) == 0) {
                                refundPercentage = 80;
                                ruleCode = "PARTIAL_80";
                                message = "Between 12 and 24 hours before service — 80% refund applies.";
                        } else if (REFUND_PERCENT_50.compareTo(percent) == 0) {
                                refundPercentage = 50;
                                ruleCode = "PARTIAL_50";
                                message = "Between 6 and 12 hours before service — 50% refund applies.";
                        } else {
                                refundPercentage = 0;
                                ruleCode = "NO_REFUND";
                                message = "Less than 6 hours before service — deposit will be forfeited.";
                        }
                }

                return CancellationPreviewResponse.builder()
                                .bookingId(bookingId)
                                .customerBookingNumber(customerBookingNumber)
                                .depositPaid(true)
                                .depositAmount(depositAmount)
                                .refundPercentage(refundPercentage)
                                .refundAmount(refundAmount)
                                .eligibleForRefund(refundAmount.compareTo(BigDecimal.ZERO) > 0)
                                .ruleCode(ruleCode)
                                .message(message)
                                .build();
        }

        private BigDecimal calculateRefundAmount(
                        Booking booking,
                        String role) {

                if (booking.getDepositAmount() == null
                                || !"PAID".equals(booking.getDepositStatus())) {

                        return BigDecimal.ZERO;

                }

                if (isGarageFaultCancellation(role)) {

                        return booking.getDepositAmount();

                }

                if (isGracePeriod(booking)) {

                        return booking.getDepositAmount();

                }

                BigDecimal percent = calculateRefundPercentage(
                                LocalDateTime.now(),
                                booking.getStartTime());

                return booking.getDepositAmount()
                                .multiply(percent)
                                .setScale(2, RoundingMode.HALF_UP);

        }

        private void releaseBookingResources(
                        Booking booking) {

                if (booking.getWashBayId() != null) {

                        washBayRepository.findById(
                                        booking.getWashBayId())
                                        .ifPresent(washBay -> {

                                                washBay.setStatus(WashBayStatus.AVAILABLE);

                                                washBay.setCurrentBookingId(null);

                                                washBayRepository.save(washBay);

                                        });

                        booking.setWashBayId(null);

                }

                List<BookingAssignedStaff> assigned = bookingAssignedStaffRepository.findByBookingId(
                                booking.getId());

                for (BookingAssignedStaff item : assigned) {

                        item.setStatus("CANCELED");

                        bookingAssignedStaffRepository.save(item);

                }

        }

        private BookingResponse toResponse(Booking b) {
                // Task 3: Compute customerBookingNumber for single-booking responses
                Integer customerBookingNumber = null;
                if (b.getCustomerId() != null && b.getId() != null) {
                        long pos = bookingRepository.countByCustomerIdAndIdLessThanEqual(b.getCustomerId(), b.getId());
                        if (pos > 0) customerBookingNumber = (int) pos;
                }

                return BookingResponse.builder()
                                .id(b.getId())
                                .customerId(b.getCustomerId())
                                .vehicleId(b.getVehicleId())
                                .garageId(b.getGarageId())
                                .servicePackageId(b.getServicePackageId())
                                .addOnServicePackageIds(getBookingAddOnIds(b.getId()))
                                .promotionId(b.getPromotionId())
                                .startTime(b.getStartTime())
                                .endTime(b.getEndTime())
                                .status(b.getStatus())
                                .paymentStatus(b.getPaymentStatus())
                                .paymentMethod(b.getPaymentMethod())
                                .originalPrice(b.getOriginalPrice())
                                .discountAmount(b.getDiscountAmount())
                                .finalPrice(b.getFinalPrice())
                                .depositAmount(b.getDepositAmount())
                                .depositStatus(b.getDepositStatus())
                                .depositPaidAt(b.getDepositPaidAt())
                                .depositTransactionId(b.getDepositTransactionId())
                                .refundAmount(b.getRefundAmount())
                                .isWalkIn(b.getIsWalkIn())
                                .usedPoints(b.getUsedPoints())
                                .note(b.getNote())
                                .createdAt(b.getCreatedAt())
                                .guestName(b.getGuestName())
                                .guestPhone(b.getGuestPhone())
                                .licensePlate(resolveLicensePlate(b))
                                .createdByStaffId(b.getCreatedByStaffId())
                                .checkedInAt(b.getCheckedInAt())
                                .startedAt(b.getStartedAt())
                                .washBayId(b.getWashBayId())
                                .washBayStartTime(b.getWashBayStartTime())
                                .washBayEndTime(b.getWashBayEndTime())
                                .completedAt(b.getCompletedAt())
                                .paidAt(b.getPaidAt())
                                .rewardProcessed(b.getRewardProcessed())
                                .pointsEarned(Boolean.TRUE.equals(b.getRewardProcessed())
                                                ? pointTransactionRepository
                                                                .findByBookingIdAndType(b.getId(), "EARN")
                                                                .map(PointTransaction::getPoints)
                                                                .orElse(null)
                                                : null)
                                .assignedCareStaffIds(resolveAssignedCareStaffIds(b.getId()))
                                // operation phase fields
                                .operationPhase(b.getOperationPhase())
                                .plannedWashStartAt(b.getPlannedWashStartAt())
                                .plannedWashEndAt(b.getPlannedWashEndAt())
                                .plannedCareStartAt(b.getPlannedCareStartAt())
                                .plannedCareEndAt(b.getPlannedCareEndAt())
                                .careStartedAt(b.getCareStartedAt())
                                .careCompletedAt(b.getCareCompletedAt())
                                .paymentExpiredAt(b.getPaymentExpiredAt())
                                // requiresCareStaff: true when care was planned (plannedCareStartAt set),
                                // indicating an AFTER_WASH inspection is required.
                                .requiresCareStaff(b.getPlannedCareStartAt() != null)
                                .careStaffShortage(resolveCareStaffShortage(b))
                                .customerBookingNumber(customerBookingNumber)
                                .build();
        }

        private List<Long> resolveAssignedCareStaffIds(Long bookingId) {
                if (bookingId == null) {
                        return List.of();
                }
                // Include RELEASED — staff who completed care are still historically assigned to the booking.
                // CANCELED records are excluded.
                return bookingAssignedStaffRepository.findByBookingId(bookingId)
                                .stream()
                                .filter(a -> "VEHICLE_CARE_STAFF".equals(a.getRoleInBooking())
                                                && !"CANCELED".equals(a.getStatus()))
                                .map(BookingAssignedStaff::getStaffProfileId)
                                .filter(Objects::nonNull)
                                .distinct()
                                .toList();
        }

        private boolean resolveCareStaffShortage(Booking b) {
                // Shortage is only relevant while a booking is actively waiting for care to begin.
                // Restricting to WAITING_FOR_CARE avoids N+1 package queries on list-view responses.
                if (!"WAITING_FOR_CARE".equals(b.getOperationPhase())) return false;
                ServicePackage mainPkg = servicePackageRepository.findById(b.getServicePackageId()).orElse(null);
                List<ServicePackage> allPkgs = buildAllPackagesForBooking(b, mainPkg);
                ResourceWindows rw = computeResourceWindows(allPkgs);
                if (!rw.requiresCareStaff || rw.requiredCareStaffCount <= 0) return false;
                // Count only VEHICLE_CARE_STAFF assignments (ASSIGNED/RESERVED/ACTIVE) via shared helper.
                long activeCount = bookingAssignedStaffRepository.findByBookingId(b.getId())
                                .stream()
                                .filter(this::isActiveCareAssignment)
                                .count();
                return activeCount < rw.requiredCareStaffCount;
        }

        private String resolveLicensePlate(Booking b) {
                if (b.getLicensePlate() != null && !b.getLicensePlate().isBlank()) {
                        return b.getLicensePlate();
                }

                if (b.getVehicleId() == null) {
                        return null;
                }

                return vehicleRepository.findById(b.getVehicleId())
                                .map(vehicle -> {
                                        if (vehicle.getRawLicensePlate() != null
                                                        && !vehicle.getRawLicensePlate().isBlank()) {
                                                return vehicle.getRawLicensePlate();
                                        }
                                        return vehicle.getNormalizedLicensePlate();
                                })
                                .orElse(null);
        }

        private BookingSummaryResponse toSummaryResponse(Booking b) {
                Vehicle vehicle = b.getVehicleId() != null
                                ? vehicleRepository.findById(b.getVehicleId()).orElse(null)
                                : null;
                // Task 3: customerBookingNumber for summary responses (used in admin/staff views).
                // When called from getCustomerBookings(), the caller overrides this field via seqMap.
                Integer customerBookingNumber = null;
                if (b.getCustomerId() != null && b.getId() != null) {
                        long pos = bookingRepository.countByCustomerIdAndIdLessThanEqual(b.getCustomerId(), b.getId());
                        if (pos > 0) customerBookingNumber = (int) pos;
                }
                return BookingSummaryResponse.builder()
                                .id(b.getId())
                                .customerId(b.getCustomerId())
                                .garageId(b.getGarageId())
                                .vehicleId(b.getVehicleId())
                                .servicePackageId(b.getServicePackageId())
                                .addOnServicePackageIds(getBookingAddOnIds(b.getId()))
                                .startTime(b.getStartTime())
                                .endTime(b.getEndTime())
                                .status(b.getStatus())
                                .paymentStatus(b.getPaymentStatus())
                                .paymentMethod(b.getPaymentMethod())
                                .finalPrice(b.getFinalPrice())
                                .isWalkIn(b.getIsWalkIn())
                                .guestName(b.getGuestName())
                                .guestPhone(b.getGuestPhone())
                                .licensePlate(resolveLicensePlate(b))
                                .vehicleName(buildVehicleName(vehicle))
                                .rewardProcessed(b.getRewardProcessed())
                                .pointsEarned(Boolean.TRUE.equals(b.getRewardProcessed())
                                                ? pointTransactionRepository.findByBookingIdAndType(b.getId(), "EARN")
                                                                .map(PointTransaction::getPoints)
                                                                .orElse(null)
                                                : null)
                                .note(b.getNote())
                                .createdAt(b.getCreatedAt())
                                .depositAmount(b.getDepositAmount())
                                .depositStatus(b.getDepositStatus())
                                .depositTransactionId(b.getDepositTransactionId())
                                .paymentExpiredAt(b.getPaymentExpiredAt())
                                .refundAmount(b.getRefundAmount())
                                .usedPoints(b.getUsedPoints())
                                .checkedInAt(b.getCheckedInAt())
                                .completedAt(b.getCompletedAt())
                                .paidAt(b.getPaidAt())
                                .operationPhase(b.getOperationPhase())
                                .washBayId(b.getWashBayId())
                                .plannedWashStartAt(b.getPlannedWashStartAt())
                                .plannedWashEndAt(b.getPlannedWashEndAt())
                                .plannedCareStartAt(b.getPlannedCareStartAt())
                                .plannedCareEndAt(b.getPlannedCareEndAt())
                                .careStartedAt(b.getCareStartedAt())
                                .careCompletedAt(b.getCareCompletedAt())
                                .requiresCareStaff(b.getPlannedCareStartAt() != null)
                                // careStaffShortage omitted on list response (avoid N+1 queries)
                                .customerBookingNumber(customerBookingNumber)
                                .build();
        }

        private boolean isVehicleTypeCompatible(
                        Vehicle vehicle,
                        ServicePackage servicePackage) {

                if (vehicle == null || servicePackage == null || servicePackage.getVehicleType() == null) {
                        return false;
                }

                String vehicleType = normalizeVehicleType(vehicle.getVehicleType());
                String packageVehicleType = normalizeVehicleType(servicePackage.getVehicleType());

                if (!vehicleType.equals(packageVehicleType)) {
                        return false;
                }

                if ("CAR".equals(vehicleType)) {
                        return isSeatCountCompatible(vehicle.getSeatCount(), servicePackage.getSeatCount());
                }

                if ("BIKE".equals(vehicleType)) {
                        if (servicePackage.getMotorbikeGroup() == null) {
                                return true;
                        }
                        return Objects.equals(vehicle.getMotorbikeGroup(), servicePackage.getMotorbikeGroup());
                }

                return true;
        }

        /**
         * A package's seatCount is treated as its base tier: it also covers vehicles
         * with one extra seat (e.g. a package for seatCount=4 also fits 5-seat cars).
         * A null package seatCount means "any seat count" (wildcard).
         */
        private boolean isSeatCountCompatible(Integer vehicleSeatCount, Integer packageSeatCount) {
                if (packageSeatCount == null) {
                        return true;
                }
                return vehicleSeatCount != null && vehicleSeatCount <= packageSeatCount + 1;
        }

        private boolean isWalkInVehicleCompatible(
                        WalkInBookingCreateRequest request,
                        ServicePackage servicePackage) {

                if (request == null || servicePackage == null || servicePackage.getVehicleType() == null) {
                        return false;
                }

                String requestVehicleType = normalizeVehicleType(request.getVehicleType());
                String packageVehicleType = normalizeVehicleType(servicePackage.getVehicleType());

                if (!requestVehicleType.equals(packageVehicleType)) {
                        return false;
                }

                if ("CAR".equals(requestVehicleType)) {
                        return isSeatCountCompatible(request.getSeatCount(), servicePackage.getSeatCount());
                }

                if ("BIKE".equals(requestVehicleType)) {
                        if (servicePackage.getMotorbikeGroup() == null) {
                                return true;
                        }
                        return Objects.equals(request.getMotorbikeGroup(), servicePackage.getMotorbikeGroup());
                }

                return true;
        }

        private boolean isVehicleTypeCompatible(
                        String vehicleType,
                        ServicePackage servicePackage) {

                if (vehicleType == null || servicePackage == null || servicePackage.getVehicleType() == null) {
                        return false;
                }

                return normalizeVehicleType(vehicleType)
                                .equals(normalizeVehicleType(servicePackage.getVehicleType()));
        }

        private BookingServiceStepResponse toServiceStepResponse(
                        BookingServiceStep step) {

                return BookingServiceStepResponse.builder()
                                .id(step.getId())
                                .bookingId(step.getBookingId())
                                .servicePackageId(step.getServicePackageId())
                                .servicePackageStepId(step.getServicePackageStepId())
                                .stepOrder(step.getStepOrder())
                                .name(step.getName())
                                .description(step.getDescription())
                                .status(step.getStatus())
                                .executionPhase(step.getExecutionPhase())
                                .durationMinutes(step.getDurationMinutes())
                                .startedAt(step.getStartedAt())
                                .completedAt(step.getCompletedAt())
                                .completedByStaffId(step.getCompletedByStaffId())
                                .build();
        }

        // ===================== ISSUE #169 Operation Phase Methods =====================

        /**
         * Returns true only when the assignment counts toward the required care staff quota:
         * roleInBooking must be VEHICLE_CARE_STAFF and status must be ASSIGNED, RESERVED, or ACTIVE.
         * RELEASED/CANCELED and other roles are intentionally excluded.
         */
        private boolean isActiveCareAssignment(BookingAssignedStaff a) {
                return "VEHICLE_CARE_STAFF".equals(a.getRoleInBooking())
                                && (ASSIGNED_STAFF_STATUS.equals(a.getStatus())
                                                || "RESERVED".equals(a.getStatus())
                                                || "ACTIVE".equals(a.getStatus()));
        }

        /**
         * Allow only CUSTOMER_SERVICE_STAFF or ADMIN to call mutation endpoints.
         * Replaces the old deny-list approach with an explicit allow-list.
         */
        private void requiresServiceOrAdmin(Long staffUserId, String role) {
                if ("ROLE_ADMIN".equals(role)) return;
                StaffProfile staffProfile = staffProfileRepository.findByUser_Id(staffUserId)
                                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN,
                                                "Staff profile not found"));
                if (!Boolean.TRUE.equals(staffProfile.getIsActive())) {
                        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Staff profile is inactive");
                }
                if (staffProfile.getStaffType() != StaffType.CUSTOMER_SERVICE_STAFF) {
                        throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                                        "Only CUSTOMER_SERVICE_STAFF or ADMIN can perform this action");
                }
        }

        private StaffProfile requireStaffForGarage(Long staffUserId, String role, Long garageId) {
                if ("ROLE_ADMIN".equals(role)) return null;
                StaffProfile staff = staffProfileRepository.findByUser_Id(staffUserId)
                                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN,
                                                "Staff profile not found"));
                if (!Boolean.TRUE.equals(staff.getIsActive())) {
                        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Staff profile is inactive");
                }
                if (!staff.getGarageId().equals(garageId)) {
                        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Booking belongs to another garage");
                }
                return staff;
        }

        @Override
        @Transactional
        public BookingResponse startWash(Long bookingId, Long staffUserId, String role, OperationPhaseRequest request) {
                requiresServiceOrAdmin(staffUserId, role);

                Booking booking = bookingRepository.findById(bookingId)
                                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found"));

                requireStaffForGarage(staffUserId, role, booking.getGarageId());

                if (!"CHECKED_IN".equals(booking.getStatus())) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                                        "Booking must be CHECKED_IN to start wash. Current status: " + booking.getStatus());
                }

                if (!"WAITING_FOR_INTAKE".equals(booking.getOperationPhase())
                                && booking.getOperationPhase() != null) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                                        "Booking must be in WAITING_FOR_INTAKE phase. Current phase: " + booking.getOperationPhase());
                }

                // Check BEFORE_WASH inspection exists
                boolean hasBeforeWash = vehicleInspectionRepository
                                .findByBookingIdOrderByCreatedAtAsc(bookingId)
                                .stream().anyMatch(i -> "BEFORE_WASH".equals(i.getType()));
                if (!hasBeforeWash) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                                        "BEFORE_WASH inspection is required before starting wash");
                }

                LocalDateTime now = LocalDateTime.now();

                // Assign wash bay
                ServicePackage servicePackage = servicePackageRepository.findById(booking.getServicePackageId())
                                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Service package not found"));

                if (Boolean.TRUE.equals(servicePackage.getRequiresWashBay())) {
                        String bayType = mapVehicleTypeToBayType(booking.getVehicleType());
                        WashBay washBay = washBayRepository
                                        .findFirstByGarageIdAndVehicleTypeAndStatusAndIsActiveTrue(
                                                        booking.getGarageId(), bayType, WashBayStatus.AVAILABLE)
                                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                                                        "No wash bay available"));
                        booking.setWashBayId(washBay.getId());
                        booking.setWashBayStartTime(now);
                        washBay.setStatus(WashBayStatus.IN_USE);
                        washBay.setCurrentBookingId(bookingId);
                        washBayRepository.save(washBay);
                }

                // Generate booking service steps if not already created
                List<BookingServiceStep> existingSteps = bookingServiceStepRepository.findByBookingIdOrderByStepOrder(bookingId);
                if (existingSteps.isEmpty()) {
                        generateBookingServiceSteps(booking, servicePackage);
                }

                // BEFORE_WASH inspection already captured intake — auto-complete any INTAKE_INSPECTION steps
                bookingServiceStepRepository.findByBookingIdOrderByStepOrder(bookingId).stream()
                                .filter(s -> "INTAKE_INSPECTION".equalsIgnoreCase(s.getExecutionPhase()))
                                .filter(s -> !"COMPLETED".equals(s.getStatus()))
                                .forEach(s -> {
                                        s.setStatus("COMPLETED");
                                        s.setCompletedAt(now);
                                        s.setCompletedByStaffId(staffUserId);
                                        bookingServiceStepRepository.save(s);
                                });

                booking.setStatus("IN_PROGRESS");
                booking.setOperationPhase("AUTOMATED_WASH");
                booking.setStartedAt(now);
                if (request != null && request.getNote() != null && !request.getNote().isBlank()) {
                        booking.setNote(request.getNote());
                }

                Booking saved = bookingRepository.save(booking);
                BookingResponse response = toResponse(saved);
                response.setAssignedCareStaffIds(resolveAssignedCareStaffIds(saved.getId()));
                return response;
        }

        @Override
        @Transactional
        public BookingResponse completeWash(Long bookingId, Long staffUserId, String role, OperationPhaseRequest request) {
                requiresServiceOrAdmin(staffUserId, role);

                Booking booking = bookingRepository.findById(bookingId)
                                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found"));

                requireStaffForGarage(staffUserId, role, booking.getGarageId());

                if (!"AUTOMATED_WASH".equals(booking.getOperationPhase())) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                                        "Booking must be in AUTOMATED_WASH phase. Current phase: " + booking.getOperationPhase());
                }

                // All AUTOMATED_WASH steps must be COMPLETED before releasing bay
                validatePhaseStepsCompleted(bookingId, "AUTOMATED_WASH");

                LocalDateTime now = LocalDateTime.now();

                // Release wash bay
                if (booking.getWashBayId() != null) {
                        washBayRepository.findById(booking.getWashBayId()).ifPresent(washBay -> {
                                washBay.setStatus(WashBayStatus.AVAILABLE);
                                washBay.setCurrentBookingId(null);
                                washBayRepository.save(washBay);
                        });
                        booking.setWashBayEndTime(now);
                }

                // Determine next phase
                ServicePackage servicePackage = servicePackageRepository.findById(booking.getServicePackageId())
                                .orElse(null);
                List<ServicePackage> allPackages = buildAllPackagesForBooking(booking, servicePackage);
                ResourceWindows rw = computeResourceWindows(allPackages);

                if (rw.requiresCareStaff) {
                        booking.setOperationPhase("WAITING_FOR_CARE");
                        // Runtime recovery: if this is an old COMBO booking whose care window was
                        // never saved (bug where COMBO includes were not expanded at creation time),
                        // compute and persist the care window now so startCare can proceed.
                        if (booking.getPlannedCareStartAt() == null) {
                                LocalDateTime careStart = now;
                                LocalDateTime careEnd = careStart.plusMinutes(rw.totalCareMinutes > 0 ? rw.totalCareMinutes : 60);
                                booking.setPlannedCareStartAt(careStart);
                                booking.setPlannedCareEndAt(careEnd);
                                log.warn("[COMBO_RECOVERY] Booking {} had null care window; set to {} – {}. "
                                        + "Run repair_combo_care_windows.sql to fix remaining bookings.",
                                        booking.getId(), careStart, careEnd);
                                // Reserve care staff using the recovered window
                                reserveCareStaff(booking, rw, careStart, careEnd);
                        }
                        // RESERVED assignments stay RESERVED until startCare activates them
                } else {
                        // No care service: proceed directly to final inspection
                        booking.setOperationPhase("FINAL_INSPECTION");
                }

                if (request != null && request.getNote() != null && !request.getNote().isBlank()) {
                        booking.setNote(request.getNote());
                }

                Booking saved = bookingRepository.save(booking);
                return toResponse(saved);
        }

        @Override
        @Transactional
        public BookingResponse startCare(Long bookingId, Long staffUserId, String role, OperationPhaseRequest request) {
                requiresServiceOrAdmin(staffUserId, role);

                Booking booking = bookingRepository.findById(bookingId)
                                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found"));

                requireStaffForGarage(staffUserId, role, booking.getGarageId());

                if (!"WAITING_FOR_CARE".equals(booking.getOperationPhase())) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                                        "Booking must be in WAITING_FOR_CARE phase. Current phase: " + booking.getOperationPhase());
                }

                if (resolveCareStaffShortage(booking)) {
                        throw new ResponseStatusException(HttpStatus.CONFLICT,
                                        "Cannot start care: insufficient RESERVED care staff. Assign staff first.");
                }

                LocalDateTime now = LocalDateTime.now();

                // Activate the RESERVED assignment
                bookingAssignedStaffRepository.findByBookingId(bookingId).stream()
                                .filter(a -> "VEHICLE_CARE_STAFF".equals(a.getRoleInBooking()))
                                .filter(a -> "RESERVED".equals(a.getStatus()) || "ASSIGNED".equals(a.getStatus()))
                                .forEach(a -> {
                                        a.setStatus("ACTIVE");
                                        bookingAssignedStaffRepository.save(a);
                                });

                booking.setOperationPhase("VEHICLE_CARE");
                booking.setCareStartedAt(now);

                if (request != null && request.getNote() != null && !request.getNote().isBlank()) {
                        booking.setNote(request.getNote());
                }

                Booking saved = bookingRepository.save(booking);
                return toResponse(saved);
        }

        @Override
        @Transactional
        public BookingResponse completeCare(Long bookingId, Long staffUserId, String role, OperationPhaseRequest request) {
                requiresServiceOrAdmin(staffUserId, role);

                Booking booking = bookingRepository.findById(bookingId)
                                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found"));

                requireStaffForGarage(staffUserId, role, booking.getGarageId());

                if (!"VEHICLE_CARE".equals(booking.getOperationPhase())) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                                        "Booking must be in VEHICLE_CARE phase. Current phase: " + booking.getOperationPhase());
                }

                // All VEHICLE_CARE steps must be COMPLETED before releasing care staff
                validatePhaseStepsCompleted(bookingId, "VEHICLE_CARE");

                LocalDateTime now = LocalDateTime.now();

                // Release ACTIVE care staff assignments
                bookingAssignedStaffRepository.findByBookingId(bookingId).stream()
                                .filter(a -> "VEHICLE_CARE_STAFF".equals(a.getRoleInBooking()))
                                .filter(a -> "ACTIVE".equals(a.getStatus()))
                                .forEach(a -> {
                                        a.setStatus("RELEASED");
                                        bookingAssignedStaffRepository.save(a);
                                });

                booking.setOperationPhase("FINAL_INSPECTION");
                booking.setCareCompletedAt(now);

                if (request != null && request.getNote() != null && !request.getNote().isBlank()) {
                        booking.setNote(request.getNote());
                }

                Booking saved = bookingRepository.save(booking);
                return toResponse(saved);
        }

        @Override
        @Transactional
        public BookingResponse completeFinalInspection(Long bookingId, Long staffUserId, String role) {
                Booking booking = bookingRepository.findById(bookingId)
                                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                                                "Booking not found: " + bookingId));

                staffOperationAccessPolicy.requireCustomerServiceOrAdminForGarage(staffUserId, role, booking.getGarageId());

                if (!"IN_PROGRESS".equals(booking.getStatus())) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                                        "Booking must be IN_PROGRESS. Current status: " + booking.getStatus());
                }

                String currentPhase = booking.getOperationPhase();
                if ("READY_FOR_HANDOVER".equals(currentPhase)) {
                        return toResponse(booking); // idempotent
                }
                if (!"FINAL_INSPECTION".equals(currentPhase)) {
                        throw new ResponseStatusException(HttpStatus.CONFLICT,
                                        "Booking must be at FINAL_INSPECTION phase to complete final inspection. "
                                                        + "Current phase: " + currentPhase);
                }

                validateAllStepsCompleted(bookingId);
                requireInspectionsBeforeCompletion(booking);
                requireFreshAfterWashInspection(booking);

                booking.setOperationPhase("READY_FOR_HANDOVER");
                Booking saved = bookingRepository.save(booking);
                return toResponse(saved);
        }

        @Override
        @Transactional
        public BookingResponse assignCareStaff(Long bookingId, Long staffUserId, String role, CareAssignmentRequest request) {
                requiresServiceOrAdmin(staffUserId, role);

                // PESSIMISTIC_WRITE on booking first to prevent race conditions
                Booking booking = bookingRepository.findByIdWithLock(bookingId)
                                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found"));

                requireStaffForGarage(staffUserId, role, booking.getGarageId());

                // Only allow assignment while booking is still open and in a phase that precedes care
                String bStatus = booking.getStatus();
                if (!"CONFIRMED".equals(bStatus) && !"CHECKED_IN".equals(bStatus) && !"IN_PROGRESS".equals(bStatus)) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                                        "Care staff can only be assigned when booking is CONFIRMED, CHECKED_IN, or IN_PROGRESS (current: " + bStatus + ")");
                }

                // Phase gate: assignment window closes once care has started
                String assignPhase = booking.getOperationPhase();
                if ("VEHICLE_CARE".equals(assignPhase) || "FINAL_INSPECTION".equals(assignPhase)
                                || "READY_FOR_HANDOVER".equals(assignPhase) || "DONE".equals(assignPhase)) {
                        throw new ResponseStatusException(HttpStatus.CONFLICT,
                                        "Cannot assign care staff at phase '" + assignPhase
                                                        + "'. Assignment is only allowed before care begins.");
                }

                // Always compute ResourceWindows from canonical package data — never trust operationPhase alone
                ServicePackage mainPkg = servicePackageRepository.findById(booking.getServicePackageId()).orElse(null);
                List<ServicePackage> allPkgs = buildAllPackagesForBooking(booking, mainPkg);
                ResourceWindows rw = computeResourceWindows(allPkgs);

                if (!rw.requiresCareStaff || rw.requiredCareStaffCount <= 0) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                                        "This booking's service package does not require vehicle care staff");
                }

                // Require valid planned care window — no silent fallback to booking window
                LocalDateTime careStart = booking.getPlannedCareStartAt();
                LocalDateTime careEnd = booking.getPlannedCareEndAt();
                if (careStart == null || careEnd == null) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                                        "Booking has no planned care window (plannedCareStartAt/EndAt). Cannot assign care staff.");
                }
                if (!careEnd.isAfter(careStart)) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                                        "Invalid care window: plannedCareEndAt must be after plannedCareStartAt");
                }

                // PESSIMISTIC_WRITE on target staff — consistent lock order: booking first, then staff
                StaffProfile careStaff = staffProfileRepository.findByIdWithLock(request.getStaffProfileId())
                                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                                                "Care staff profile not found: " + request.getStaffProfileId()));

                // Must be an active VEHICLE_CARE_STAFF from the same garage
                if (careStaff.getStaffType() != StaffType.VEHICLE_CARE_STAFF) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                                        "Only VEHICLE_CARE_STAFF can be assigned as care staff");
                }
                if (!Boolean.TRUE.equals(careStaff.getIsActive())) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Care staff is inactive");
                }
                if (!careStaff.getGarageId().equals(booking.getGarageId())) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                                        "Care staff belongs to a different garage");
                }

                List<BookingAssignedStaff> existing = bookingAssignedStaffRepository.findByBookingId(bookingId);
                long currentCount = existing.stream()
                                .filter(this::isActiveCareAssignment)
                                .count();

                // Block over-assignment
                if (currentCount >= rw.requiredCareStaffCount) {
                        throw new ResponseStatusException(HttpStatus.CONFLICT,
                                        "Booking already has " + currentCount
                                                        + " care staff assigned (required: " + rw.requiredCareStaffCount + ")");
                }

                // Check all existing records for this booking+staff pair (not just active ones).
                // This prevents UQ_booking_staff violations and gives meaningful business messages.
                java.util.Optional<BookingAssignedStaff> existingForStaff = existing.stream()
                                .filter(a -> careStaff.getId().equals(a.getStaffProfileId())
                                                && "VEHICLE_CARE_STAFF".equals(a.getRoleInBooking()))
                                .findFirst();

                if (existingForStaff.isPresent()) {
                        String existingStatus = existingForStaff.get().getStatus();
                        if ("RELEASED".equals(existingStatus)) {
                                // Staff has already completed care for this booking — re-assignment is not allowed here.
                                throw new ResponseStatusException(HttpStatus.CONFLICT,
                                                "Care assignment has already been completed for staff "
                                                                + careStaff.getStaffCode()
                                                                + ". Use the recover-care-workflow endpoint if care must restart.");
                        }
                        if ("ASSIGNED".equals(existingStatus) || "RESERVED".equals(existingStatus)
                                        || "ACTIVE".equals(existingStatus)) {
                                throw new ResponseStatusException(HttpStatus.CONFLICT,
                                                "This care staff member is already assigned to this booking");
                        }
                        if ("CANCELED".equals(existingStatus)) {
                                // Reuse the canceled record to avoid UQ constraint violation on re-assign
                                BookingAssignedStaff prev = existingForStaff.get();
                                prev.setAssignedFrom(careStart);
                                prev.setAssignedTo(careEnd);
                                prev.setRoleInBooking(careStaff.getStaffType().name());
                                prev.setStatus("RESERVED");
                                bookingAssignedStaffRepository.save(prev);
                                BookingResponse reusedResponse = toResponse(booking);
                                reusedResponse.setAssignedCareStaffIds(resolveAssignedCareStaffIds(booking.getId()));
                                return reusedResponse;
                        }
                }

                // Check the staff member has no overlapping assignments at another booking
                long overlap = bookingAssignedStaffRepository.countOverlap(
                                careStaff.getId(), careStart, careEnd);
                if (overlap > 0) {
                        throw new ResponseStatusException(HttpStatus.CONFLICT,
                                        "Care staff is already assigned to another booking during the care window");
                }

                // No existing record — INSERT new assignment
                BookingAssignedStaff assignment = new BookingAssignedStaff();
                assignment.setBookingId(bookingId);
                assignment.setStaffProfileId(careStaff.getId());
                assignment.setAssignedFrom(careStart);
                assignment.setAssignedTo(careEnd);
                assignment.setRoleInBooking(careStaff.getStaffType().name());
                assignment.setStatus("RESERVED");
                bookingAssignedStaffRepository.save(assignment);

                BookingResponse response = toResponse(booking);
                response.setAssignedCareStaffIds(resolveAssignedCareStaffIds(booking.getId()));
                return response;
        }

        @Override
        @Transactional(readOnly = true)
        public List<AvailableCareStaffResponse> getAvailableCareStaff(Long bookingId, Long userId, String role) {
                requiresServiceOrAdmin(userId, role);

                Booking booking = bookingRepository.findById(bookingId)
                                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found"));

                requireStaffForGarage(userId, role, booking.getGarageId());

                // Booking must be open (not terminal)
                String bStatus = booking.getStatus();
                if ("COMPLETED".equals(bStatus) || "CANCELED".equals(bStatus)
                                || "CANCELLED".equals(bStatus) || "NO_SHOW".equals(bStatus)) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                                        "Booking is closed — no care staff available (status=" + bStatus + ")");
                }

                // Phase gate: assignment window closes once care has started
                String availPhase = booking.getOperationPhase();
                if ("VEHICLE_CARE".equals(availPhase) || "FINAL_INSPECTION".equals(availPhase)
                                || "READY_FOR_HANDOVER".equals(availPhase) || "DONE".equals(availPhase)) {
                        return List.of();
                }

                // Compute requirement from canonical package data
                ServicePackage mainPkg = servicePackageRepository.findById(booking.getServicePackageId()).orElse(null);
                List<ServicePackage> allPkgs = buildAllPackagesForBooking(booking, mainPkg);
                ResourceWindows rw = computeResourceWindows(allPkgs);

                if (!rw.requiresCareStaff || rw.requiredCareStaffCount <= 0) {
                        return List.of();
                }

                // Care window must be present — error if missing, no silent fallback
                LocalDateTime careStart = booking.getPlannedCareStartAt();
                LocalDateTime careEnd = booking.getPlannedCareEndAt();
                if (careStart == null || careEnd == null) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                                        "Booking has no planned care window. Cannot list available care staff.");
                }
                if (!careEnd.isAfter(careStart)) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                                        "Invalid care window: plannedCareEndAt must be after plannedCareStartAt");
                }

                // Use findAvailableStaff — excludes staff with ASSIGNED/RESERVED/ACTIVE overlaps
                // (RELEASED/CANCELED are not considered busy, so they don't block availability)
                StaffType staffType = StaffType.VEHICLE_CARE_STAFF;
                List<StaffProfile> available = bookingAssignedStaffRepository.findAvailableStaff(
                                booking.getGarageId(), staffType, careStart, careEnd);

                // Exclude staff already assigned to THIS booking (ASSIGNED/RESERVED/ACTIVE)
                List<BookingAssignedStaff> thisBookingAssignments = bookingAssignedStaffRepository.findByBookingId(bookingId);
                java.util.Set<Long> alreadyAssignedIds = thisBookingAssignments.stream()
                                .filter(this::isActiveCareAssignment)
                                .map(BookingAssignedStaff::getStaffProfileId)
                                .collect(java.util.stream.Collectors.toSet());

                return available.stream()
                                .filter(sp -> !alreadyAssignedIds.contains(sp.getId()))
                                .sorted(java.util.Comparator.comparing(sp -> {
                                        String name = sp.getUser() != null && sp.getUser().getFullName() != null
                                                        ? sp.getUser().getFullName() : sp.getStaffCode();
                                        return name != null ? name : "";
                                }))
                                .map(sp -> AvailableCareStaffResponse.builder()
                                                .staffProfileId(sp.getId())
                                                .displayName(sp.getUser() != null ? sp.getUser().getFullName() : sp.getStaffCode())
                                                .staffCode(sp.getStaffCode())
                                                .garageId(sp.getGarageId())
                                                .build())
                                .toList();
        }

        @Override
        @Transactional(readOnly = true)
        public CareAssignmentStatusResponse getCareAssignmentStatus(Long bookingId, Long userId, String role) {
                requiresServiceOrAdmin(userId, role);

                Booking booking = bookingRepository.findById(bookingId)
                                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found"));

                requireStaffForGarage(userId, role, booking.getGarageId());

                // Compute requirement from canonical package data
                ServicePackage mainPkg = servicePackageRepository.findById(booking.getServicePackageId()).orElse(null);
                List<ServicePackage> allPkgs = buildAllPackagesForBooking(booking, mainPkg);
                ResourceWindows rw = computeResourceWindows(allPkgs);

                String bStatus = booking.getStatus();
                String phase = booking.getOperationPhase();
                LocalDateTime careStart = booking.getPlannedCareStartAt();
                LocalDateTime careEnd = booking.getPlannedCareEndAt();

                boolean isClosedStatus = "COMPLETED".equals(bStatus) || "CANCELED".equals(bStatus)
                                || "CANCELLED".equals(bStatus) || "NO_SHOW".equals(bStatus);
                // Care workflow has progressed past the assignment window
                boolean careWorkflowCompleted = "FINAL_INSPECTION".equals(phase)
                                || "READY_FOR_HANDOVER".equals(phase)
                                || "DONE".equals(phase)
                                || isClosedStatus;
                // Care is actively in progress — assignment window has also closed
                boolean careWorkflowInProgress = "VEHICLE_CARE".equals(phase);

                // canAssign: only valid before care workflow starts (before VEHICLE_CARE phase)
                boolean canAssign = !careWorkflowCompleted && !careWorkflowInProgress && !isClosedStatus
                                && ("CONFIRMED".equals(bStatus) || "CHECKED_IN".equals(bStatus)
                                                || "IN_PROGRESS".equals(bStatus))
                                && rw.requiresCareStaff
                                && rw.requiredCareStaffCount > 0
                                && careStart != null
                                && careEnd != null
                                && careEnd.isAfter(careStart);

                if (!rw.requiresCareStaff) {
                        return CareAssignmentStatusResponse.builder()
                                        .requiresCareStaff(false)
                                        .requiredCount(0)
                                        .assignedCount(0)
                                        .shortage(false)
                                        .plannedCareStartAt(careStart)
                                        .plannedCareEndAt(careEnd)
                                        .canAssign(false)
                                        .operationPhase(phase)
                                        .build();
                }

                List<BookingAssignedStaff> assignments = bookingAssignedStaffRepository.findByBookingId(bookingId);
                int assignedCount;
                boolean shortage;

                if (careWorkflowCompleted) {
                        // RELEASED = care was completed; count as "assigned" so UI shows history correctly.
                        assignedCount = (int) assignments.stream()
                                        .filter(a -> "VEHICLE_CARE_STAFF".equals(a.getRoleInBooking())
                                                        && !"CANCELED".equals(a.getStatus()))
                                        .count();
                        shortage = false; // care is done — shortage is irrelevant
                } else if (careWorkflowInProgress) {
                        // Care is happening right now — count active assignments
                        assignedCount = (int) assignments.stream()
                                        .filter(this::isActiveCareAssignment)
                                        .count();
                        shortage = false; // care has started — shortage warning no longer needed
                } else {
                        // Pre-care: only ASSIGNED/RESERVED/ACTIVE count toward quota
                        assignedCount = (int) assignments.stream()
                                        .filter(this::isActiveCareAssignment)
                                        .count();
                        shortage = assignedCount < rw.requiredCareStaffCount;
                }

                return CareAssignmentStatusResponse.builder()
                                .requiresCareStaff(true)
                                .requiredCount(rw.requiredCareStaffCount)
                                .assignedCount(assignedCount)
                                .shortage(shortage)
                                .plannedCareStartAt(careStart)
                                .plannedCareEndAt(careEnd)
                                .canAssign(canAssign)
                                .operationPhase(phase)
                                .build();
        }

        @Override
        @Transactional(readOnly = true)
        public List<AssignedCareStaffResponse> getAssignedCareStaff(Long bookingId, Long userId, String role) {
                requiresServiceOrAdmin(userId, role);

                Booking booking = bookingRepository.findById(bookingId)
                                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found"));

                requireStaffForGarage(userId, role, booking.getGarageId());

                // Include RELEASED — completed care assignments are part of booking history.
                // CANCELED is excluded (assignment was voided before care started).
                return bookingAssignedStaffRepository.findByBookingId(bookingId).stream()
                                .filter(a -> "VEHICLE_CARE_STAFF".equals(a.getRoleInBooking())
                                                && !"CANCELED".equals(a.getStatus()))
                                .map(a -> {
                                        StaffProfile sp = staffProfileRepository.findById(a.getStaffProfileId())
                                                        .orElse(null);
                                        String displayName = sp != null && sp.getUser() != null
                                                        ? sp.getUser().getFullName()
                                                        : "Staff #" + a.getStaffProfileId();
                                        String staffCode = sp != null ? sp.getStaffCode() : null;
                                        return AssignedCareStaffResponse.builder()
                                                        .staffProfileId(a.getStaffProfileId())
                                                        .displayName(displayName)
                                                        .staffCode(staffCode)
                                                        .assignmentStatus(a.getStatus())
                                                        .build();
                                })
                                .sorted(java.util.Comparator.comparing(r -> r.getDisplayName() != null ? r.getDisplayName() : ""))
                                .toList();
        }

        private static final Set<String> VALID_CARE_TASK_STATUSES = Set.of("RESERVED", "ACTIVE", "RELEASED");

        @Override
        @Transactional(readOnly = true)
        public List<CareTaskResponse> getCareTasksForCurrentStaff(Long careStaffUserId, String status, LocalDate date, int page, int limit) {
                if (page < 0) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Page must be >= 0");
                }
                if (limit < 1 || limit > 100) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Limit must be between 1 and 100");
                }

                // Validate optional status filter before hitting the DB
                String normalizedStatus = (status == null || status.isBlank() || "ALL".equalsIgnoreCase(status))
                        ? null
                        : status.toUpperCase();
                if (normalizedStatus != null && !VALID_CARE_TASK_STATUSES.contains(normalizedStatus)) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                                "Invalid status filter. Must be one of: RESERVED, ACTIVE, RELEASED, ALL");
                }

                StaffProfile staffProfile = staffProfileRepository.findByUser_Id(careStaffUserId)
                                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN,
                                                "Staff profile not found"));

                if (!Boolean.TRUE.equals(staffProfile.getIsActive())) {
                        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Staff profile is inactive");
                }

                if (staffProfile.getStaffType() != StaffType.VEHICLE_CARE_STAFF) {
                        throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                                        "Only VEHICLE_CARE_STAFF can access care tasks");
                }

                LocalDateTime startDate = date != null ? date.atStartOfDay() : null;
                LocalDateTime endDate = date != null ? date.plusDays(1).atStartOfDay() : null;

                List<BookingAssignedStaff> assignments = bookingAssignedStaffRepository.findVisibleCareTaskAssignments(
                                staffProfile.getId(),
                                VALID_CARE_TASK_STATUSES,
                                normalizedStatus,
                                startDate,
                                endDate,
                                org.springframework.data.domain.PageRequest.of(page, limit));

                return assignments.stream()
                                .map(a -> {
                                        Booking b = bookingRepository.findById(a.getBookingId()).orElse(null);
                                        if (b == null) return null;

                                        // Collect service names without exposing financial data
                                        List<String> serviceNames = new ArrayList<>();
                                        servicePackageRepository.findById(b.getServicePackageId())
                                                        .ifPresent(pkg -> serviceNames.add(pkg.getName()));
                                        getBookingAddOnIds(b.getId()).forEach(addOnId ->
                                                        servicePackageRepository.findById(addOnId)
                                                                        .ifPresent(pkg -> serviceNames.add(pkg.getName())));

                                        return CareTaskResponse.builder()
                                                        .assignmentId(a.getId())
                                                        .bookingId(b.getId())
                                                        .vehicleType(b.getVehicleType())
                                                        .licensePlate(resolveLicensePlate(b))
                                                        .serviceNames(serviceNames)
                                                        .instructions(b.getNote())
                                                        .plannedStartAt(a.getAssignedFrom())
                                                        .plannedEndAt(a.getAssignedTo())
                                                        .status(a.getStatus())
                                                        .serviceStaffNote(b.getNote())
                                                        .bookingOperationPhase(b.getOperationPhase())
                                                        .build();
                                })
                                .filter(Objects::nonNull)
                                .toList();
        }

        /**
         * Returns the execution phase for a step template.  Uses the template's stored
         * value when set; otherwise infers from the template's own service package:
         * a package requiring care staff → VEHICLE_CARE, otherwise → AUTOMATED_WASH.
         */
        private String inferExecutionPhase(ServicePackageStep template) {
                String stored = template.getExecutionPhase();
                if (stored != null && !stored.isBlank()) {
                        return stored;
                }
                ServicePackage pkg = template.getServicePackage();
                if (pkg != null && Boolean.TRUE.equals(pkg.getRequiresCareStaff())) {
                        return "VEHICLE_CARE";
                }
                return "AUTOMATED_WASH";
        }

        /** Build the effective package list for an existing booking, expanding COMBO includes. */
        private List<ServicePackage> buildAllPackagesForBooking(Booking booking, ServicePackage mainPkg) {
                LinkedHashMap<Long, ServicePackage> dedupMap = new LinkedHashMap<>();
                if (mainPkg != null) {
                        for (ServicePackage p : packageResourceResolver.resolveEffectivePackages(mainPkg)) {
                                dedupMap.put(p.getId(), p);
                        }
                }
                for (Long addOnId : getBookingAddOnIds(booking.getId())) {
                        servicePackageRepository.findById(addOnId).ifPresent(addOn -> {
                                for (ServicePackage p : packageResourceResolver.resolveEffectivePackages(addOn)) {
                                        dedupMap.putIfAbsent(p.getId(), p);
                                }
                        });
                }
                return new ArrayList<>(dedupMap.values());
        }

        /** Generate BookingServiceStep records from package step templates. */
        private void generateBookingServiceSteps(Booking booking, ServicePackage servicePackage) {
                List<ServicePackageStep> mainTemplates = comboStepResolver.resolveSteps(servicePackage);
                List<ServicePackageStep> addOnTemplates = new ArrayList<>();
                for (Long addOnId : getBookingAddOnIds(booking.getId())) {
                        addOnTemplates.addAll(servicePackageStepRepository.findByServicePackage_IdOrderByStepOrder(addOnId));
                }
                List<ServicePackageStep> orderedTemplates = new ArrayList<>();
                orderedTemplates.addAll(mainTemplates);
                orderedTemplates.addAll(addOnTemplates);

                int stepOrder = 1;
                for (ServicePackageStep template : orderedTemplates) {
                        BookingServiceStep step = new BookingServiceStep();
                        step.setBookingId(booking.getId());
                        step.setServicePackageId(template.getServicePackage().getId());
                        step.setServicePackageStepId(template.getId());
                        step.setStepOrder(stepOrder++);
                        step.setName(template.getName());
                        step.setDescription(template.getDescription());
                        step.setStatus("PENDING");
                        step.setExecutionPhase(inferExecutionPhase(template));
                        step.setDurationMinutes(template.getDurationMinutes());
                        bookingServiceStepRepository.save(step);
                }
        }

        /**
         * Reserve care staff for an already-confirmed booking if it requires care staff and
         * no reservation exists yet.  Idempotent — safe to call multiple times.
         * Intended to be called after a DEPOSIT webhook confirms a PENDING_DEPOSIT online booking.
         */
        @Override
        @Transactional
        public void reserveCareStaffIfNeeded(Long bookingId) {
                Booking booking = bookingRepository.findById(bookingId).orElse(null);
                if (booking == null) {
                        log.warn("reserveCareStaffIfNeeded: booking {} not found", bookingId);
                        return;
                }

                LocalDateTime careStart = booking.getPlannedCareStartAt();
                LocalDateTime careEnd = booking.getPlannedCareEndAt();
                if (careStart == null || careEnd == null) {
                        return; // no care window — nothing to reserve
                }

                // Idempotency: skip if a RESERVED / ACTIVE / ASSIGNED VEHICLE_CARE_STAFF entry already exists.
                // Filter by roleInBooking so a WASH_BAY_OPERATOR assignment does not falsely prevent care reservation.
                boolean alreadyReserved = bookingAssignedStaffRepository.findByBookingId(bookingId)
                                .stream()
                                .anyMatch(this::isActiveCareAssignment);
                if (alreadyReserved) {
                        log.info("Care staff already reserved for booking {}, skipping", bookingId);
                        return;
                }

                ServicePackage mainPkg = booking.getServicePackageId() != null
                                ? servicePackageRepository.findById(booking.getServicePackageId()).orElse(null)
                                : null;
                List<ServicePackage> allPackages = buildAllPackagesForBooking(booking, mainPkg);
                ResourceWindows rw = computeResourceWindows(allPackages);

                if (rw.requiresCareStaff) {
                        reserveCareStaff(booking, rw, careStart, careEnd);
                }
        }

        /**
         * Issue #5: Reserve care staff for a CONFIRMED walk-in booking immediately at creation.
         * Creates BookingAssignedStaff records with status RESERVED using the care window
         * (plannedCareStart → plannedCareEnd) rather than the full booking window.
         */
        private void reserveCareStaff(Booking booking, ResourceWindows rw,
                        LocalDateTime careStart, LocalDateTime careEnd) {
                if (!rw.requiresCareStaff || rw.requiredCareStaffCount <= 0
                                || rw.careStaffType == null || rw.careStaffType.isBlank()) {
                        return;
                }
                StaffType staffType;
                try {
                        staffType = StaffType.valueOf(rw.careStaffType);
                } catch (IllegalArgumentException e) {
                        log.warn("Unknown care staff type '{}' for booking {}, skipping reservation",
                                        rw.careStaffType, booking.getId());
                        return;
                }
                List<StaffProfile> candidates = bookingAssignedStaffRepository
                                .findAvailableStaff(booking.getGarageId(), staffType, careStart, careEnd);
                int reserved = 0;
                for (StaffProfile candidate : candidates) {
                        if (reserved >= rw.requiredCareStaffCount) break;
                        BookingAssignedStaff bas = bookingAssignedStaffRepository.findByBookingId(booking.getId()).stream()
                                        .filter(a -> candidate.getId().equals(a.getStaffProfileId()))
                                        .filter(a -> "VEHICLE_CARE_STAFF".equals(a.getRoleInBooking()))
                                        .filter(a -> "CANCELED".equals(a.getStatus()))
                                        .findFirst()
                                        .orElseGet(BookingAssignedStaff::new);
                        bas.setBookingId(booking.getId());
                        bas.setStaffProfileId(candidate.getId());
                        bas.setAssignedFrom(careStart);
                        bas.setAssignedTo(careEnd);
                        bas.setRoleInBooking(rw.careStaffType);
                        bas.setStatus("RESERVED");
                        bookingAssignedStaffRepository.save(bas);
                        reserved++;
                }
                if (reserved < rw.requiredCareStaffCount) {
                        // Log at ERROR so this surfaces in monitoring.
                        // The booking remains CONFIRMED because payment is already committed.
                        // Action required: Admin must manually assign care staff via
                        // PATCH /bookings/{id}/care-assignment before Start Care is possible.
                        log.error(
                                "[CARE_STAFF_SHORTAGE] Booking {} confirmed but only {}/{} care staff reserved "
                                + "(garage={}, careWindow={} – {}). Manual assignment required.",
                                booking.getId(), reserved, rw.requiredCareStaffCount,
                                booking.getGarageId(), careStart, careEnd);
                }
        }

        // ===================== Staff Booking Summary =====================

        @Override
        public StaffBookingSummaryResponse getStaffBookingSummary(Long staffUserId, String role) {
                // Only CUSTOMER_SERVICE_STAFF may call this — ADMIN and VEHICLE_CARE_STAFF are denied.
                StaffProfile staffProfile = staffProfileRepository.findByUser_Id(staffUserId)
                                .orElseThrow(() -> new ResponseStatusException(
                                                HttpStatus.FORBIDDEN, "Staff profile not found"));

                if (!Boolean.TRUE.equals(staffProfile.getIsActive())) {
                        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Staff profile is inactive");
                }

                if (staffProfile.getStaffType() != StaffType.CUSTOMER_SERVICE_STAFF) {
                        throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                                        "Only CUSTOMER_SERVICE_STAFF can access this summary");
                }

                Long garageId = staffProfile.getGarageId();

                long total = bookingRepository.countByGarageIdExcludingPendingDeposit(garageId);
                long confirmed = bookingRepository.countByGarageIdAndStatus(garageId, "CONFIRMED");
                long inProgress = bookingRepository.countByGarageIdAndStatus(garageId, "IN_PROGRESS");
                long canceledAndNoShow = bookingRepository.countByGarageIdAndStatusIn(
                                garageId, List.of("CANCELED", "CANCELLED", "NO_SHOW"));

                return StaffBookingSummaryResponse.builder()
                                .total(total)
                                .confirmed(confirmed)
                                .inProgress(inProgress)
                                .canceledAndNoShow(canceledAndNoShow)
                                .build();
        }

        // ===================== Staff Calendar =====================

        @Override
        public List<StaffCalendarDayResponse> getStaffCalendar(Long staffUserId, String role, int year, int month) {
                StaffProfile staffProfile = staffProfileRepository.findByUser_Id(staffUserId)
                                .orElseThrow(() -> new ResponseStatusException(
                                                HttpStatus.FORBIDDEN, "Staff profile not found"));

                if (!Boolean.TRUE.equals(staffProfile.getIsActive())) {
                        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Staff profile is inactive");
                }

                if (staffProfile.getStaffType() != StaffType.CUSTOMER_SERVICE_STAFF) {
                        throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                                        "Only CUSTOMER_SERVICE_STAFF can access the calendar");
                }

                Long garageId = staffProfile.getGarageId();

                LocalDateTime start = LocalDateTime.of(year, month, 1, 0, 0);
                LocalDateTime end   = start.plusMonths(1);

                List<Object[]> rows = bookingRepository.findDateAndStatusForCalendar(garageId, start, end);

                // Group by date
                java.util.Map<java.time.LocalDate, long[]> dayMap = new java.util.TreeMap<>();
                for (Object[] row : rows) {
                        java.time.LocalDateTime dt = (java.time.LocalDateTime) row[0];
                        String status = String.valueOf(row[1]).toUpperCase();
                        java.time.LocalDate date = dt.toLocalDate();
                        dayMap.computeIfAbsent(date, d -> new long[2]);
                        long[] counts = dayMap.get(date);
                        if ("CONFIRMED".equals(status)) counts[0]++;
                        else if ("CANCELED".equals(status) || "CANCELLED".equals(status)) counts[1]++;
                }

                return dayMap.entrySet().stream()
                                .map(entry -> StaffCalendarDayResponse.builder()
                                                .date(entry.getKey())
                                                .confirmed(entry.getValue()[0])
                                                .cancelled(entry.getValue()[1])
                                                .build())
                                .toList();
        }
}
