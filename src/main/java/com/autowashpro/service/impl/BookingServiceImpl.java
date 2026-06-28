package com.autowashpro.service.impl;
import com.autowashpro.entity.enums.StaffType;
import com.autowashpro.dto.request.BookingCreateRequest;
import com.autowashpro.dto.request.StartServiceRequest;
import com.autowashpro.dto.request.WalkInBookingCreateRequest;
import com.autowashpro.dto.response.AvailableSlotResponse;
import com.autowashpro.dto.response.BookingResponse;
import com.autowashpro.dto.response.SlotResponse;
import com.autowashpro.entity.*;
import com.autowashpro.entity.enums.WashBayStatus;
import com.autowashpro.repository.*;
import com.autowashpro.service.BookingService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import com.autowashpro.dto.response.BookingSummaryResponse;
import java.util.Objects;
import java.math.BigDecimal;
import java.math.RoundingMode;
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
        private final VehicleRepository vehicleRepository;
        private final CustomerLoyaltyRepository customerLoyaltyRepository;
        private final LoyaltyTierRuleRepository loyaltyTierRuleRepository;
        private final PromotionRepository promotionRepository;
        private final BookingAssignedStaffRepository bookingAssignedStaffRepository;
        private final StaffProfileRepository staffProfileRepository;
        private final UserRepository userRepository;
        private final BookingServiceStepRepository bookingServiceStepRepository;
        private final ServicePackageStepRepository servicePackageStepRepository;

        // ===================== ISSUE #10 =====================

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

                LocalTime current = garage.getOpeningTime();

                while (current.plusMinutes(servicePackage.getDurationMinutes()).isBefore(garage.getClosingTime())
                                || current.plusMinutes(servicePackage.getDurationMinutes())
                                                .equals(garage.getClosingTime())) {

                        LocalDateTime start = LocalDateTime.of(date, current);
                        LocalDateTime end = start.plusMinutes(servicePackage.getDurationMinutes());

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

                Garage garage = garageRepository.findById(request.getGarageId())
                                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                                                "Garage not found"));
                if (!Boolean.TRUE.equals(garage.getIsActive())) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Garage is inactive");
                }

                LocalDateTime startTime = request.getStartTime();
                LocalDateTime endTime = startTime.plusMinutes(pkg.getDurationMinutes());

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
                String tier = loyalty != null ? loyalty.getCurrentTier() : "SILVER";

                LoyaltyTierRule tierRule = loyaltyTierRuleRepository.findByTierAndIsActiveTrue(tier)
                                .orElseThrow(() -> new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR,
                                                "Loyalty tier rule not found for tier: " + tier));

                LocalDateTime maxBookingTime = LocalDateTime.now().plusDays(tierRule.getBookingWindowDays());
                if (startTime.isAfter(maxBookingTime)) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                                        "Booking date exceeds allowed window of " + tierRule.getBookingWindowDays()
                                                        + " days for tier " + tier);
                }

                long upcomingCount = bookingRepository.countUpcomingBookings(customerId, LocalDateTime.now());
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

                if (Boolean.TRUE.equals(pkg.getRequiresWashBay())) {
                        long availableBays = washBayRepository
                                        .countAvailableByGarageAndVehicleType(request.getGarageId(), bayType);
                        long occupiedBays = bookingRepository.countOverlappingBookingsByGarageAndVehicleType(
                                        request.getGarageId(), bayType, startTime, endTime);
                        if (occupiedBays >= availableBays) {
                                throw new ResponseStatusException(HttpStatus.CONFLICT,
                                                "No wash bay available for this time slot");
                        }
                }

                if (Boolean.TRUE.equals(pkg.getRequiresCareStaff()) && pkg.getCareStaffRequiredCount() > 0) {
StaffType staffType = StaffType.valueOf(pkg.getCareStaffType());

long totalStaff = staffProfileRepository
        .countByGarageIdAndStaffTypeAndIsActiveTrue(
                request.getGarageId(),
                staffType);
                        long assignedStaff = bookingAssignedStaffRepository
                                        .countAssignedStaffByGarageAndTypeAndTime(
                                                        request.getGarageId(),
                                                        staffType,
                                                        startTime,
                                                        endTime);
                        if ((totalStaff - assignedStaff) < pkg.getCareStaffRequiredCount()) {
                                throw new ResponseStatusException(HttpStatus.CONFLICT,
                                                "Not enough care staff available for this time slot");
                        }
                }

                BigDecimal originalPrice = pkg.getBasePrice();
                BigDecimal discountAmount = BigDecimal.ZERO;
                Long promotionId = null;

                if (request.getPromotionCode() != null && !request.getPromotionCode().isBlank()) {
                        Promotion promotion = promotionRepository.findByCodeAndIsActiveTrue(request.getPromotionCode())
                                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                                                        "Invalid or expired promotion code: "
                                                                        + request.getPromotionCode()));

                        LocalDateTime now = LocalDateTime.now();
                        if (now.isBefore(promotion.getStartAt()) || now.isAfter(promotion.getEndAt())) {
                                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Promotion is not active");
                        }
                        if (promotion.getMinOrderAmount() != null
                                        && originalPrice.compareTo(promotion.getMinOrderAmount()) < 0) {
                                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                                                "Order amount does not meet minimum requirement for this promotion");
                        }
                        if (promotion.getUsageLimit() != null
                                        && promotion.getUsedCount() >= promotion.getUsageLimit()) {
                                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                                                "Promotion usage limit reached");
                        }

                        BigDecimal promoDiscount;
                        if ("PERCENT".equalsIgnoreCase(promotion.getDiscountType())) {
                                promoDiscount = originalPrice.multiply(promotion.getDiscountValue())
                                                .divide(BigDecimal.valueOf(100), 2, RoundingMode.HALF_UP);
                                if (promotion.getMaxDiscountAmount() != null) {
                                        promoDiscount = promoDiscount.min(promotion.getMaxDiscountAmount());
                                }
                        } else {
                                promoDiscount = promotion.getDiscountValue();
                        }

                        discountAmount = discountAmount.add(promoDiscount);
                        promotionId = promotion.getId();
                        promotion.setUsedCount(promotion.getUsedCount() + 1);
                        promotionRepository.save(promotion);
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
                booking.setFinalPrice(finalPrice);
                booking.setDepositAmount(depositAmount);
                booking.setDepositStatus("UNPAID");
                booking.setRefundAmount(BigDecimal.ZERO);
                booking.setIsWalkIn(false);
                booking.setRewardProcessed(false);
                booking.setUsedPoints(usedPoints);
                booking.setNote(request.getNote());

                Booking saved = bookingRepository.save(booking);
                return toResponse(saved);
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

                String normalizedPlate = request.getLicensePlate().toUpperCase()
                                .replaceAll("[\\s.\\-]", "")
                                .replaceAll("[^A-Z0-9]", "");

                LocalDateTime startTime = request.getStartTime();
                LocalDateTime endTime = startTime.plusMinutes(pkg.getDurationMinutes());

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

                if (Boolean.TRUE.equals(pkg.getRequiresWashBay())) {
                        long availableBays = washBayRepository.countAvailableByGarageAndVehicleType(
                                        request.getGarageId(), bayType);
                        long occupiedBays = bookingRepository.countOverlappingBookingsByGarage(
                                        request.getGarageId(), startTime, endTime);
                        if (occupiedBays >= availableBays) {
                                throw new ResponseStatusException(HttpStatus.CONFLICT,
                                                "No wash bay available for this time slot");
                        }
                }

                if (Boolean.TRUE.equals(pkg.getRequiresCareStaff()) && pkg.getCareStaffRequiredCount() > 0) {
StaffType staffType = StaffType.valueOf(pkg.getCareStaffType());

                        long totalStaff = staffProfileRepository
                                        .countByGarageIdAndStaffTypeAndIsActiveTrue(
                                                        request.getGarageId(),
                                                        staffType);

                        long assignedStaff = bookingAssignedStaffRepository
                                        .countAssignedStaffByGarageAndTypeAndTime(
                                                        request.getGarageId(),
                                                        staffType,
                                                        startTime,
                                                        endTime);
                        if ((totalStaff - assignedStaff) < pkg.getCareStaffRequiredCount()) {
                                throw new ResponseStatusException(HttpStatus.CONFLICT,
                                                "Not enough care staff available for this time slot");
                        }
                }

                Booking booking = new Booking();
                booking.setCustomerId(null);
                booking.setVehicleId(null);
                booking.setGarageId(request.getGarageId());
                booking.setServicePackageId(request.getServicePackageId());
                booking.setCreatedByStaffId(staffUserId);
                booking.setBookingDate(startTime.toLocalDate());
                booking.setStartTime(startTime);
                booking.setEndTime(endTime);
                booking.setStatus("CONFIRMED");
                booking.setPaymentStatus("UNPAID");
                booking.setOriginalPrice(pkg.getBasePrice());
                booking.setSurchargeAmount(BigDecimal.ZERO);
                booking.setDiscountAmount(BigDecimal.ZERO);
                booking.setFinalPrice(pkg.getBasePrice());
                booking.setDepositAmount(BigDecimal.ZERO);
                booking.setDepositStatus("UNPAID");
                booking.setRefundAmount(BigDecimal.ZERO);
                booking.setIsWalkIn(true);
                booking.setGuestName(request.getGuestName());
                booking.setGuestPhone(request.getGuestPhone());
                booking.setLicensePlate(normalizedPlate);
                booking.setRewardProcessed(false);
                booking.setUsedPoints(0);
                booking.setNote(request.getNote());

                Booking saved = bookingRepository.save(booking);
                return toResponse(saved);
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
                List<ServicePackageStep> templates = servicePackageStepRepository
                                .findByServicePackage_IdOrderByStepOrder(
                                                servicePackage.getId());

                for (ServicePackageStep template : templates) {

                        BookingServiceStep step = new BookingServiceStep();

                        step.setBookingId(booking.getId());

                        step.setServicePackageId(servicePackage.getId());

                        step.setServicePackageStepId(template.getId());

                        step.setStepOrder(template.getStepOrder());

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

                List<Long> staffIds = bookingAssignedStaffRepository
                                .findByBookingId(saved.getId())
                                .stream()
                                .map(BookingAssignedStaff::getStaffProfileId)
                                .toList();

                response.setAssignedCareStaffIds(staffIds);

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
                                                "Customer can only cancel booking before check-in. Current status: " + status);
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
                                                                Math.max(0, loyalty.getRedeemedPoints() - booking.getUsedPoints()));
                                                customerLoyaltyRepository.save(loyalty);
                                        });
                }

                booking.setStatus("CANCELED");
                booking.setNote(reason != null ? reason : booking.getNote());
                booking.setRewardProcessed(false);

                Booking saved = bookingRepository.save(booking);
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

        // ===================== HELPER =====================

        private BookingResponse toResponse(Booking b) {
                return BookingResponse.builder()
                                .id(b.getId())
                                .customerId(b.getCustomerId())
                                .vehicleId(b.getVehicleId())
                                .garageId(b.getGarageId())
                                .servicePackageId(b.getServicePackageId())
                                .promotionId(b.getPromotionId())
                                .startTime(b.getStartTime())
                                .endTime(b.getEndTime())
                                .status(b.getStatus())
                                .paymentStatus(b.getPaymentStatus())
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
                                .licensePlate(b.getLicensePlate())
                                .createdByStaffId(b.getCreatedByStaffId())
                                .checkedInAt(b.getCheckedInAt())
                                .startedAt(b.getStartedAt())
                                .washBayId(b.getWashBayId())
                                .build();
        }

        private BookingSummaryResponse toSummaryResponse(Booking b) {
                return BookingSummaryResponse.builder()
                                .id(b.getId())
                                .customerId(b.getCustomerId())
                                .garageId(b.getGarageId())
                                .vehicleId(b.getVehicleId())
                                .servicePackageId(b.getServicePackageId())
                                .startTime(b.getStartTime())
                                .endTime(b.getEndTime())
                                .status(b.getStatus())
                                .paymentStatus(b.getPaymentStatus())
                                .finalPrice(b.getFinalPrice())
                                .isWalkIn(b.getIsWalkIn())
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
}
