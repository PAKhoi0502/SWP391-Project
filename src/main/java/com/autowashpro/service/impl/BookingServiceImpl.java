package com.autowashpro.service.impl;

import com.autowashpro.service.WashHistoryService;
import com.autowashpro.entity.enums.StaffType;
import com.autowashpro.dto.request.BookingCreateRequest;
import com.autowashpro.dto.request.CompleteBookingServiceStepRequest;
import com.autowashpro.dto.request.MarkBookingPaidRequest;
import com.autowashpro.dto.request.UpdatePaymentMethodRequest;
import com.autowashpro.dto.request.PromotionValidateRequest;
import com.autowashpro.dto.request.ReopenBookingServiceStepRequest;
import com.autowashpro.dto.request.StartServiceRequest;
import com.autowashpro.dto.request.WalkInBookingCreateRequest;
import com.autowashpro.dto.response.AvailableSlotResponse;
import com.autowashpro.dto.response.BookingResponse;
import com.autowashpro.dto.response.BookingServiceStepResponse;
import com.autowashpro.dto.response.SlotResponse;
import com.autowashpro.dto.response.WalkInCustomerLookupResponse;
import com.autowashpro.entity.*;
import com.autowashpro.entity.enums.WashBayStatus;
import com.autowashpro.repository.*;
import com.autowashpro.service.BookingService;
import com.autowashpro.service.LoyaltyService;
import com.autowashpro.service.PromotionService;
import com.autowashpro.service.EmailService;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import com.autowashpro.dto.response.BookingSummaryResponse;
import com.autowashpro.dto.response.PromotionValidateResponse;
import com.autowashpro.service.NotificationService;

import java.util.Objects;
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

@Service
@RequiredArgsConstructor
public class BookingServiceImpl implements BookingService {

        private static final String ASSIGNED_STAFF_STATUS = "ASSIGNED";

        private final GarageRepository garageRepository;
        private final ServicePackageRepository servicePackageRepository;
        private final WashBayRepository washBayRepository;
        private final BookingRepository bookingRepository;
        private final VehicleRepository vehicleRepository;
        private final CustomerLoyaltyRepository customerLoyaltyRepository;
        private final LoyaltyTierRuleRepository loyaltyTierRuleRepository;
        private final PromotionRepository promotionRepository;
        private final BookingAssignedStaffRepository bookingAssignedStaffRepository;
        private final StaffProfileRepository staffProfileRepository;
        private final UserRepository userRepository;
        private final BookingServiceStepRepository bookingServiceStepRepository;
        private final ServicePackageStepRepository servicePackageStepRepository;
        private final ComboStepResolver comboStepResolver;
        private final BookingAddOnServicePackageRepository bookingAddOnServicePackageRepository;
        private final PointTransactionRepository pointTransactionRepository;
        private final LoyaltyService loyaltyService;
        private final WashHistoryService washHistoryService;
        private final PromotionService promotionService;
        private final NotificationService notificationService;
        private final EmailService emailService;

        // ===================== ISSUE #10 =====================

        @Override
        public AvailableSlotResponse getAvailableSlots(
                        Long garageId,
                        Long servicePackageId,
                        String vehicleType,
                        LocalDate date,
                        boolean isWalkIn) {

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
                int slotDurationMinutes = resolveSlotDurationMinutes(servicePackage, garage);

                while (current.plusMinutes(slotDurationMinutes).isBefore(garage.getClosingTime())
                                || current.plusMinutes(slotDurationMinutes)
                                                .equals(garage.getClosingTime())) {

                        LocalDateTime start = LocalDateTime.of(date, current);
                        LocalDateTime end = start.plusMinutes(slotDurationMinutes);

                        if (!start.isAfter(now)) {
                                current = current.plusMinutes(garage.getSlotIntervalMinutes());
                                continue;
                        }

                        boolean available = isWashBayAvailable(
                                        garageId,
                                        vehicleType,
                                        start,
                                        end);

                        if (available) {
                                available = isCareStaffAvailable(
                                                garageId,
                                                servicePackage,
                                                start,
                                                end);
                        }

                        slots.add(
                                        SlotResponse.builder()
                                                        .startTime(start)
                                                        .endTime(end)
                                                        .available(available)
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
                List<ServicePackage> selected = new ArrayList<>();
                selected.add(mainPackage);
                selected.addAll(addOns);
                return selected;
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
                                                "Vehicle is not compatible with selected add-on service package: " + addOnId);
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
                                        .countAssignedStaffByGarageAndTypeAndTime(garageId, entry.getKey(), startTime, endTime);

                        if ((totalStaff - assignedStaff) < entry.getValue()) {
                                throw new ResponseStatusException(HttpStatus.CONFLICT,
                                                "Not enough care staff available for this time slot");
                        }
                }
        }

        private boolean requiresWashBay(List<ServicePackage> servicePackages) {
                return servicePackages.stream().anyMatch(servicePackage -> Boolean.TRUE.equals(servicePackage.getRequiresWashBay()));
        }

        private List<Long> getBookingAddOnIds(Long bookingId) {
                if (bookingId == null) return List.of();

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

                long availableBays = washBayRepository.countAvailableByGarageAndVehicleType(
                                garageId,
                                bayType);

                long occupied = bookingRepository.countOverlappingBookingsByGarageAndVehicleType(
                                garageId,
                                bayType,
                                start,
                                end);

                return occupied < availableBays;
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
                String tier = loyalty != null ? loyalty.getCurrentTier() : "BRONZE";

                LoyaltyTierRule tierRule = loyaltyTierRuleRepository.findByTierAndIsActiveTrue(tier)
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

                if (requiresWashBay(selectedPackages)) {
                        long availableBays = washBayRepository
                                        .countAvailableByGarageAndVehicleType(request.getGarageId(), bayType);
                        long occupiedBays = bookingRepository.countOverlappingBookingsByGarageAndVehicleType(
                                        request.getGarageId(), bayType, startTime, endTime);
                        if (occupiedBays >= availableBays) {
                                throw new ResponseStatusException(HttpStatus.CONFLICT,
                                                "No wash bay available for this time slot");
                        }
                }

                validateCareStaffAvailability(request.getGarageId(), selectedPackages, startTime, endTime);

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
                BigDecimal depositAmount = finalPrice.multiply(BigDecimal.valueOf(0.3)).setScale(2,
                                RoundingMode.HALF_UP);

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
                booking.setStatus("CONFIRMED");
                booking.setPaymentStatus("UNPAID");
                booking.setOriginalPrice(originalPrice);
                booking.setSurchargeAmount(BigDecimal.ZERO);
                booking.setDiscountAmount(discountAmount);
                booking.setPromotionDiscountAmount(
                                promotionDiscountAmount);
                booking.setFinalPrice(finalPrice);
                booking.setDepositAmount(depositAmount);
                booking.setDepositStatus("UNPAID");
                booking.setRefundAmount(BigDecimal.ZERO);
                booking.setIsWalkIn(false);
                booking.setRewardProcessed(false);
                booking.setUsedPoints(usedPoints);
                booking.setNote(request.getNote());

                Booking saved = bookingRepository.save(booking);

                int sortOrder = 1;
                for (ServicePackage addOn : addOns) {
                        BookingAddOnServicePackage bookingAddOn = new BookingAddOnServicePackage();
                        bookingAddOn.setBookingId(saved.getId());
                        bookingAddOn.setServicePackageId(addOn.getId());
                        bookingAddOn.setSortOrder(sortOrder++);
                        bookingAddOnServicePackageRepository.save(bookingAddOn);
                }

                loyaltyService.updateBookingStatistics(booking.getId());
                notificationService.notifyBookingConfirmed(booking.getId());

                BookingResponse response = toResponse(saved);
                response.setAddOnServicePackageIds(addOns.stream().map(ServicePackage::getId).toList());
                return response;
        }

        // ===================== ISSUE #12 =====================

        @Override
        @Transactional
        public BookingResponse createWalkInBooking(WalkInBookingCreateRequest request, Long staffUserId) {

                StaffProfile staffProfile = staffProfileRepository.findByUser_Id(staffUserId)
                                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN,
                                                "No staff profile found for current user"));

                if (!Boolean.TRUE.equals(staffProfile.getIsActive())) {
                        throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Staff profile is inactive");
                }

                if (!staffProfile.getGarageId().equals(request.getGarageId())) {
                        throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                                        "Staff can only create walk-in booking for their assigned garage");
                }

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

                String normalizedPlate = normalizeLicensePlate(request.getLicensePlate());

                LocalDateTime startTime = request.getStartTime();
                LocalDateTime endTime = startTime.plusMinutes(resolveSlotDurationMinutes(selectedPackages, garage));

                String bayType = mapVehicleTypeToBayType(request.getVehicleType());
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

                long plateOverlap = bookingRepository.countOverlappingBookingsByLicensePlate(
                                normalizedPlate, startTime, endTime);
                if (plateOverlap > 0) {
                        throw new ResponseStatusException(HttpStatus.CONFLICT,
                                        "License plate already has an active booking during this time");
                }

                if (requiresWashBay(selectedPackages)) {
                        long availableBays = washBayRepository.countAvailableByGarageAndVehicleType(
                                        request.getGarageId(), bayType);
                        long occupiedBays = bookingRepository.countOverlappingBookingsByGarageAndVehicleType(
                                        request.getGarageId(), bayType, startTime, endTime);

                        if (occupiedBays >= availableBays) {
                                throw new ResponseStatusException(HttpStatus.CONFLICT,
                                                "No wash bay available for this time slot");
                        }
                }

                validateCareStaffAvailability(request.getGarageId(), selectedPackages, startTime, endTime);

                User matchedCustomer = findActiveCustomerByPhone(request.getGuestPhone());
                Vehicle matchedVehicle = findMatchedCustomerVehicle(matchedCustomer, normalizedPlate);

                // Auto-save new vehicle for known customers when the plate is not in their profile yet
                if (matchedCustomer != null && matchedVehicle == null && normalizedPlate != null) {
                        Vehicle newVehicle = new Vehicle();
                        newVehicle.setCustomer(matchedCustomer);
                        newVehicle.setRawLicensePlate(request.getLicensePlate().trim().toUpperCase());
                        newVehicle.setNormalizedLicensePlate(normalizedPlate);
                        newVehicle.setVehicleType(request.getVehicleType() != null
                                        ? request.getVehicleType().toUpperCase() : "CAR");
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

                String paymentMethod = normalizeWalkInPaymentMethod(request.getPaymentMethod());

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
                booking.setPaymentMethod(paymentMethod);
                BigDecimal originalPrice = sumBasePrice(selectedPackages);
                booking.setOriginalPrice(originalPrice);
                booking.setSurchargeAmount(BigDecimal.ZERO);
                booking.setDiscountAmount(BigDecimal.ZERO);
                booking.setFinalPrice(originalPrice);
                booking.setDepositAmount(BigDecimal.ZERO);
                booking.setDepositStatus("UNPAID");
                booking.setRefundAmount(BigDecimal.ZERO);
                booking.setIsWalkIn(true);
                booking.setGuestName(matchedCustomer != null ? matchedCustomer.getFullName() : request.getGuestName());
                booking.setGuestPhone(matchedCustomer != null ? matchedCustomer.getPhone() : normalizePhone(request.getGuestPhone()));
                booking.setLicensePlate(normalizedPlate);
                booking.setRewardProcessed(false);
                booking.setUsedPoints(0);
                booking.setNote(request.getNote());

                Booking saved = bookingRepository.save(booking);

                int sortOrder = 1;
                for (ServicePackage addOn : addOns) {
                        BookingAddOnServicePackage bookingAddOn = new BookingAddOnServicePackage();
                        bookingAddOn.setBookingId(saved.getId());
                        bookingAddOn.setServicePackageId(addOn.getId());
                        bookingAddOn.setSortOrder(sortOrder++);
                        bookingAddOnServicePackageRepository.save(bookingAddOn);
                }

                loyaltyService.updateBookingStatistics(saved.getId());
                notificationService.notifyBookingConfirmed(saved.getId());
                return toResponse(saved);
        }

        @Override
        public WalkInCustomerLookupResponse lookupWalkInCustomerByPhone(String phone, String licensePlate) {
                User customer = findActiveCustomerByPhone(phone);
                if (customer == null) {
                        return WalkInCustomerLookupResponse.builder()
                                        .found(false)
                                        .build();
                }

                String normalizedPlate = normalizeLicensePlate(licensePlate);
                Vehicle matchedVehicle = normalizedPlate == null
                                ? null
                                : findMatchedCustomerVehicle(customer, normalizedPlate);

                String matchedVehicleName = buildVehicleName(matchedVehicle);

                List<WalkInCustomerLookupResponse.VehicleSummary> vehicleSummaries =
                                vehicleRepository.findByCustomer_IdAndIsActiveTrue(customer.getId())
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
                if (v == null) return null;
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
        public List<BookingSummaryResponse> getCustomerBookings(
                        Long customerId,
                        String status) {

                List<Booking> bookings = bookingRepository.findByCustomerIdOrderByStartTimeDesc(customerId);

                return bookings.stream()

                                .filter(b -> status == null
                                                || status.isBlank()
                                                || b.getStatus().equalsIgnoreCase(status))

                                .map(this::toSummaryResponse)

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
                        String status,
                        LocalDate date) {

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
                        String note) {

                StaffProfile staff = staffProfileRepository
                                .findByUser_Id(staffUserId)
                                .orElseThrow(() -> new ResponseStatusException(
                                                HttpStatus.FORBIDDEN,
                                                "Staff profile not found"));

                Booking booking = bookingRepository.findById(bookingId)
                                .orElseThrow(() -> new ResponseStatusException(
                                                HttpStatus.NOT_FOUND,
                                                "Booking not found"));

                if (!booking.getGarageId().equals(staff.getGarageId())) {

                        throw new ResponseStatusException(
                                        HttpStatus.FORBIDDEN,
                                        "Booking belongs to another garage");
                }

                if (!"CONFIRMED".equals(booking.getStatus())) {

                        throw new ResponseStatusException(
                                        HttpStatus.BAD_REQUEST,
                                        "Only confirmed booking can be checked in");
                }

                booking.setStatus("CHECKED_IN");

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
                        StartServiceRequest request) {

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

                Booking booking = bookingRepository
                                .findById(bookingId)
                                .orElseThrow(() -> new ResponseStatusException(
                                                HttpStatus.NOT_FOUND,
                                                "Booking not found"));

                if (!booking.getGarageId().equals(staff.getGarageId())) {
                        throw new ResponseStatusException(
                                        HttpStatus.FORBIDDEN,
                                        "Booking belongs to another garage");
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

                // Add-on steps are inserted right before the final main step (handover),
                // so staff still hand over the car last. If main has just one step,
                // there's no handover phase to protect — it must run first.
                List<ServicePackageStep> orderedTemplates = new ArrayList<>();
                if (mainTemplates.size() > 1) {
                        orderedTemplates.addAll(mainTemplates.subList(0, mainTemplates.size() - 1));
                        orderedTemplates.addAll(addOnTemplates);
                        orderedTemplates.add(mainTemplates.get(mainTemplates.size() - 1));
                } else {
                        orderedTemplates.addAll(mainTemplates);
                        orderedTemplates.addAll(addOnTemplates);
                }

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

                        bookingServiceStepRepository.save(step);
                }

                // ================= Update Booking =================
                booking.setStatus("IN_PROGRESS");

                booking.setStartedAt(LocalDateTime.now());

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
                                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                                                "Booking not found: " + bookingId));

                String status = booking.getStatus();

                if ("ROLE_CUSTOMER".equals(role)) {
                        if (!currentUserId.equals(booking.getCustomerId())) {
                                throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                                                "You can only cancel your own bookings");
                        }
                        if (!"CONFIRMED".equals(status) && !"PENDING_DEPOSIT".equals(status)) {
                                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                                                "Customer can only cancel booking before check-in. Current status: "
                                                                + status);
                        }
                } else {
                        if ("ROLE_STAFF".equals(role)) {
                                StaffProfile staffProfile = staffProfileRepository.findByUser_Id(currentUserId)
                                                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN,
                                                                "No staff profile found"));
                                if (!staffProfile.getGarageId().equals(booking.getGarageId())) {
                                        throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                                                        "Staff can only cancel bookings in their assigned garage");
                                }
                        }
                        if (!"CONFIRMED".equals(status) && !"CHECKED_IN".equals(status)
                                        && !"PENDING_DEPOSIT".equals(status)) {
                                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                                                "Cannot cancel booking with status: " + status);
                        }
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
                        assignedStaff.setStatus("RELEASED");
                        bookingAssignedStaffRepository.save(assignedStaff);
                }

                if (booking.getUsedPoints() != null && booking.getUsedPoints() > 0
                                && !"CHECKED_IN".equals(status)) {
                        customerLoyaltyRepository.findByCustomerId(booking.getCustomerId())
                                        .ifPresent(loyalty -> {
                                                loyalty.setAvailablePoints(
                                                                loyalty.getAvailablePoints() + booking.getUsedPoints());
                                                loyalty.setRedeemedPoints(
                                                                Math.max(0, loyalty.getRedeemedPoints()
                                                                                - booking.getUsedPoints()));
                                                customerLoyaltyRepository.save(loyalty);
                                        });
                }

                booking.setStatus("CANCELED");
                booking.setNote(reason != null ? reason : booking.getNote());
                booking.setRewardProcessed(false);

                Booking saved = bookingRepository.save(booking);
                // Hoàn điểm nếu có
                loyaltyService.refundPointsForCanceledBooking(saved.getId());
                return toResponse(saved);
        }

        @Override
        @Transactional
        public BookingResponse markNoShow(Long bookingId, Long staffUserId, String reason) {

                Booking booking = bookingRepository.findById(bookingId)
                                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                                                "Booking not found: " + bookingId));

                StaffProfile staffProfile = staffProfileRepository.findByUser_Id(staffUserId)
                                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN,
                                                "No staff profile found"));
                if (!staffProfile.getGarageId().equals(booking.getGarageId())) {
                        throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                                        "Staff can only mark no-show for bookings in their assigned garage");
                }

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
                        assignedStaff.setStatus("RELEASED");
                        bookingAssignedStaffRepository.save(assignedStaff);
                }

                booking.setStatus("NO_SHOW");
                booking.setNote(reason != null ? reason : booking.getNote());
                booking.setRewardProcessed(false);

                Booking saved = bookingRepository.save(booking);
                return toResponse(saved);
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

                // STAFF
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

                // 2. Validate garage permission — ADMIN bypass
                if (!"ROLE_ADMIN".equals(role)) {
                        StaffProfile staff = staffProfileRepository.findByUser_Id(staffUserId)
                                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN,
                                                        "Staff profile not found"));

                        if (!Boolean.TRUE.equals(staff.getIsActive())) {
                                throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Staff profile is inactive");
                        }

                        if (!booking.getGarageId().equals(staff.getGarageId())) {
                                throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                                                "Staff cannot complete booking from another garage");
                        }
                }

                // 3. Validate status
                if (!"IN_PROGRESS".equals(booking.getStatus())) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                                        "Only IN_PROGRESS booking can be completed. Current status: "
                                                        + booking.getStatus());
                }

                // 4. Release wash bay nếu có
                if (booking.getWashBayId() != null) {
                        washBayRepository.findById(booking.getWashBayId()).ifPresent(washBay -> {
                                washBay.setStatus(WashBayStatus.AVAILABLE);
                                washBay.setCurrentBookingId(null);
                                washBayRepository.save(washBay);
                        });
                        booking.setWashBayId(null);
                }

                // 5. Release care staff nếu có
                List<BookingAssignedStaff> assignedStaffs = bookingAssignedStaffRepository
                                .findByBookingId(bookingId);
                for (BookingAssignedStaff assignedStaff : assignedStaffs) {
                        assignedStaff.setStatus("RELEASED");
                        bookingAssignedStaffRepository.save(assignedStaff);
                }

                // 6. Update booking
                booking.setStatus("COMPLETED");
                booking.setCompletedAt(LocalDateTime.now());
                booking.setRewardProcessed(false);
                if (note != null && !note.isBlank()) {
                        booking.setNote(note);
                }

                Booking saved = bookingRepository.save(booking);

                return toResponse(saved);
        }

        @Override
        public BookingServiceStepResponse completeServiceStep(
                        Long stepId,
                        Long staffUserId,
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

                if (!staffProfile.getGarageId().equals(booking.getGarageId())) {

                        throw new ResponseStatusException(
                                        HttpStatus.FORBIDDEN,
                                        "You cannot update service steps from another garage");
                }

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

                if (!staffProfile.getGarageId().equals(booking.getGarageId())) {

                        throw new ResponseStatusException(
                                        HttpStatus.FORBIDDEN,
                                        "You cannot update service steps from another garage");
                }

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

                if (!staffProfile.getGarageId().equals(booking.getGarageId())) {

                        throw new ResponseStatusException(
                                        HttpStatus.FORBIDDEN,
                                        "You cannot update booking from another garage");
                }

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
notificationService.notifyPaymentConfirmed(saved.getId());
notificationService.notifyRewardEarned(saved.getId());
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
                String normalizedPhone = normalizePhone(phone);
                if (normalizedPhone == null) {
                        return null;
                }

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

        private Vehicle findMatchedCustomerVehicle(User customer, String normalizedPlate) {
                if (customer == null || normalizedPlate == null) {
                        return null;
                }

                return vehicleRepository
                                .findByCustomer_IdAndNormalizedLicensePlateAndIsActiveTrue(
                                                customer.getId(),
                                                normalizedPlate)
                                .orElse(null);
        }

        private String normalizePhone(String phone) {
                if (phone == null) {
                        return null;
                }

                String normalized = phone.trim().replaceAll("[\\s.\\-()]", "");
                return normalized.isBlank() ? null : normalized;
        }

        private String normalizeLicensePlate(String licensePlate) {
                if (licensePlate == null) {
                        return null;
                }

                String normalized = licensePlate.toUpperCase()
                                .replaceAll("[\\s.\\-]", "")
                                .replaceAll("[^A-Z0-9]", "");
                return normalized.isBlank() ? null : normalized;
        }

        private BookingResponse toResponse(Booking b) {
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
                                .build();
        }

        private List<Long> resolveAssignedCareStaffIds(Long bookingId) {
                if (bookingId == null) {
                        return List.of();
                }

                return bookingAssignedStaffRepository.findByBookingId(bookingId)
                                .stream()
                                .filter(assignedStaff -> ASSIGNED_STAFF_STATUS.equals(assignedStaff.getStatus()))
                                .map(BookingAssignedStaff::getStaffProfileId)
                                .filter(Objects::nonNull)
                                .distinct()
                                .toList();
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
                        if (servicePackage.getSeatCount() == null) {
                                return true;
                        }
                        return Objects.equals(vehicle.getSeatCount(), servicePackage.getSeatCount());
                }

                if ("BIKE".equals(vehicleType)) {
                        if (servicePackage.getMotorbikeGroup() == null) {
                                return true;
                        }
                        return Objects.equals(vehicle.getMotorbikeGroup(), servicePackage.getMotorbikeGroup());
                }

                return true;
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
                        if (servicePackage.getSeatCount() == null) {
                                return true;
                        }
                        return Objects.equals(request.getSeatCount(), servicePackage.getSeatCount());
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
                                .startedAt(step.getStartedAt())
                                .completedAt(step.getCompletedAt())
                                .completedByStaffId(step.getCompletedByStaffId())

                                .build();
        }
}
