package com.autowashpro.service.impl;

import com.autowashpro.dto.request.BookingCreateRequest;
import com.autowashpro.dto.request.CreateWaitlistRequest;
import com.autowashpro.dto.response.WaitlistResponse;
import com.autowashpro.entity.*;
import com.autowashpro.entity.enums.StaffType;
import com.autowashpro.repository.*;
import com.autowashpro.service.BookingService;
import com.autowashpro.service.WaitlistService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import com.autowashpro.service.NotificationService;
import com.autowashpro.service.EmailService;

import java.time.LocalDateTime;
import java.util.List;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class WaitlistServiceImpl implements WaitlistService {

    private final WaitlistRepository waitlistRepository;
    private final GarageRepository garageRepository;
    private final VehicleRepository vehicleRepository;
    private final ServicePackageRepository servicePackageRepository;
    private final WashBayRepository washBayRepository;
    private final BookingRepository bookingRepository;
    private final StaffProfileRepository staffProfileRepository;
    private final CustomerLoyaltyRepository customerLoyaltyRepository;
    private final UserRepository userRepository;
    private final BookingService bookingService;
    private final NotificationService notificationService;
    private final EmailService emailService;

    @Value("${waitlist.cutoff-hours}")
    private int cutoffHours;

    private static final List<String> ACTIVE_STATUSES = List.of("WAITING", "OFFERED");

    // ===================== CREATE =====================

    @Override
    @Transactional
    public WaitlistResponse createWaitlist(CreateWaitlistRequest request, Long customerId) {

        Garage garage = garageRepository.findById(request.getGarageId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Garage not found"));

        Vehicle vehicle = vehicleRepository.findByIdAndCustomer_Id(request.getVehicleId(), customerId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Vehicle not found or does not belong to current customer"));

        ServicePackage pkg = servicePackageRepository.findById(request.getServicePackageId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Service package not found"));

        LocalDateTime desiredStart = request.getDesiredStartTime();
        LocalDateTime desiredEnd = desiredStart.plusMinutes(pkg.getDurationMinutes());

        // Rule: cutoff 12h — không cho tạo waitlist nếu đã quá gần giờ hẹn
        LocalDateTime cutoffLimit = desiredStart.minusHours(cutoffHours);
        if (LocalDateTime.now().isAfter(cutoffLimit)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Desired start time is too close. Waitlist requires at least " + cutoffHours
                            + " hours before the desired time");
        }

        // Rule: chỉ tạo waitlist khi slot thực sự FULL
        String reason = request.getReason();
        boolean slotFull = isSlotFull(garage, vehicle, pkg, desiredStart, desiredEnd, reason);
        if (!slotFull) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Slot is still available. Please book directly instead of joining the waitlist");
        }

        // Rule: không cho tạo waitlist trùng (customer đã có WAITING/OFFERED cùng nhu cầu)
        List<Waitlist> duplicates = waitlistRepository
                .findByCustomerIdAndGarageIdAndServicePackageIdAndDesiredStartTimeAndStatusIn(
                        customerId, request.getGarageId(), request.getServicePackageId(),
                        desiredStart, ACTIVE_STATUSES);
        if (!duplicates.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "You already have an active waitlist entry for this request");
        }

        CustomerLoyalty loyalty = customerLoyaltyRepository.findByCustomerId(customerId).orElse(null);
        String tier = loyalty != null ? loyalty.getCurrentTier() : "BRONZE";

        Waitlist waitlist = new Waitlist();
        waitlist.setGarageId(request.getGarageId());
        waitlist.setCustomerId(customerId);
        waitlist.setVehicleId(request.getVehicleId());
        waitlist.setServicePackageId(request.getServicePackageId());
        waitlist.setDesiredStartTime(desiredStart);
        waitlist.setDesiredEndTime(desiredEnd);
        waitlist.setVehicleType(vehicle.getVehicleType());
        waitlist.setPriorityLevel(1);
        waitlist.setCustomerTier(tier);
        waitlist.setStatus("WAITING");
        waitlist.setReason(reason);

        Waitlist saved = waitlistRepository.save(waitlist);
        return toResponse(saved);
    }

    private boolean isSlotFull(Garage garage, Vehicle vehicle, ServicePackage pkg,
                                LocalDateTime start, LocalDateTime end, String reason) {

        String bayType = "BIKE".equalsIgnoreCase(normalizeVehicleType(vehicle.getVehicleType())) ? "BIKE" : "CAR";

        if ("NO_BAY".equals(reason)) {
            long availableBays = washBayRepository.countAvailableByGarageAndVehicleType(garage.getId(), bayType);
            long occupiedBays = bookingRepository.countOverlappingBookingsByGarageAndVehicleType(
                    garage.getId(), bayType, start, end);
            return occupiedBays >= availableBays;
        }

        if ("NO_CARE_STAFF".equals(reason)) {
            if (!Boolean.TRUE.equals(pkg.getRequiresCareStaff())) {
                return false;
            }
            // Simplified check: rely on caller-provided reason; detailed staff capacity
            // check already enforced at booking creation time.
            return true;
        }

        return false;
    }

    private String normalizeVehicleType(String vehicleType) {
        if (vehicleType == null) return "";
        String normalized = vehicleType.trim().toUpperCase();
        if (normalized.contains("BIKE") || normalized.contains("MOTOR")) return "BIKE";
        return "CAR";
    }

    // ===================== CUSTOMER VIEW =====================

    @Override
    public Page<WaitlistResponse> getMyWaitlists(Long customerId, int page, int limit) {
        PageRequest pageable = PageRequest.of(page - 1, limit);
        return waitlistRepository.findByCustomerIdOrderByCreatedAtDesc(customerId, pageable)
                .map(this::toResponse);
    }

    @Override
    public WaitlistResponse getMyWaitlistDetail(Long id, Long customerId) {
        Waitlist waitlist = waitlistRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Waitlist not found: " + id));

        if (!waitlist.getCustomerId().equals(customerId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You cannot access this waitlist entry");
        }

        return toResponse(waitlist);
    }

    // ===================== CANCEL =====================

    @Override
    @Transactional
    public WaitlistResponse cancelWaitlist(Long id, Long customerId) {

        Waitlist waitlist = waitlistRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Waitlist not found: " + id));

        if (!waitlist.getCustomerId().equals(customerId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You cannot cancel this waitlist entry");
        }

        if (!"WAITING".equals(waitlist.getStatus()) && !"OFFERED".equals(waitlist.getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Only WAITING or OFFERED waitlist entries can be canceled. Current status: "
                            + waitlist.getStatus());
        }

        waitlist.setStatus("CANCELED");
        waitlist.setCanceledAt(LocalDateTime.now());

        Waitlist saved = waitlistRepository.save(waitlist);
        return toResponse(saved);
    }

    // ===================== ADMIN/STAFF VIEW =====================

    @Override
    public Page<WaitlistResponse> getAdminWaitlists(Long garageId, String status, Long staffUserId, String role,
                                                      int page, int limit) {

        PageRequest pageable = PageRequest.of(page - 1, limit);

        StaffProfile staff = requireCustomerServiceOrAdmin(staffUserId, role);

        Long effectiveGarageId = garageId;
        if (staff != null) {
            effectiveGarageId = staff.getGarageId();
        }

        if (effectiveGarageId != null && status != null && !status.isBlank()) {
            return waitlistRepository
                    .findByGarageIdAndStatusOrderByCreatedAtDesc(effectiveGarageId, status, pageable)
                    .map(this::toResponse);
        } else if (effectiveGarageId != null) {
            return waitlistRepository.findByGarageIdOrderByCreatedAtDesc(effectiveGarageId, pageable)
                    .map(this::toResponse);
        } else if (status != null && !status.isBlank()) {
            return waitlistRepository.findByStatusOrderByCreatedAtDesc(status, pageable)
                    .map(this::toResponse);
        } else {
            return waitlistRepository.findAllByOrderByCreatedAtDesc(pageable)
                    .map(this::toResponse);
        }
    }

    // ===================== OFFER =====================

    @Override
    @Transactional
    public WaitlistResponse offerWaitlist(Long id, Long staffUserId, String role) {

        Waitlist waitlist = waitlistRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Waitlist not found: " + id));

        validateStaffScope(waitlist, staffUserId, role);

        if (!"WAITING".equals(waitlist.getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Only WAITING waitlist entries can be offered. Current status: " + waitlist.getStatus());
        }

        // Rule: không offer nếu đã qua mốc cutoff
        LocalDateTime cutoffLimit = waitlist.getDesiredStartTime().minusHours(cutoffHours);
        if (LocalDateTime.now().isAfter(cutoffLimit)) {
            waitlist.setStatus("EXPIRED");
            waitlist.setExpiredAt(LocalDateTime.now());
            waitlistRepository.save(waitlist);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Waitlist entry has passed the cutoff time and has been expired");
        }

        // Rule: không cho staff offer nếu bay thực ra vẫn đang đầy — tránh mời
        // khách nhận 1 slot mà lúc accept chắc chắn sẽ bị từ chối lại.
        String bayType = normalizeVehicleType(waitlist.getVehicleType());
        long availableBays = washBayRepository.countAvailableByGarageAndVehicleType(
                waitlist.getGarageId(), bayType);
        long occupiedBays = bookingRepository.countOverlappingBookingsByGarageAndVehicleType(
                waitlist.getGarageId(), bayType,
                waitlist.getDesiredStartTime(), waitlist.getDesiredEndTime());

        if (occupiedBays >= availableBays) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "No wash bay available for this time slot yet — cannot offer this waitlist entry");
        }

        waitlist.setStatus("OFFERED");
        waitlist.setOfferedAt(LocalDateTime.now());
        waitlist.setOfferExpiresAt(LocalDateTime.now().plusHours(2)); // default offer validity window

        Waitlist saved = waitlistRepository.save(waitlist);

        notificationService.notifyWaitlistOffered(saved.getId());
        emailService.sendWaitlistOfferedEmail(saved.getId(), saved.getOfferExpiresAt());
        return toResponse(saved);
    }

    // ===================== ACCEPT =====================

    @Override
    @Transactional
    public WaitlistResponse acceptWaitlistOffer(Long id, Long customerId) {

        Waitlist waitlist = waitlistRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Waitlist not found: " + id));

        if (!waitlist.getCustomerId().equals(customerId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You cannot accept this waitlist offer");
        }

        if (!"OFFERED".equals(waitlist.getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Only OFFERED waitlist entries can be accepted. Current status: " + waitlist.getStatus());
        }

        if (waitlist.getOfferExpiresAt() == null || LocalDateTime.now().isAfter(waitlist.getOfferExpiresAt())) {
            waitlist.setStatus("EXPIRED");
            waitlist.setExpiredAt(LocalDateTime.now());
            waitlistRepository.save(waitlist);
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "This waitlist offer has expired and cannot be accepted");
        }

        // Recheck capacity + create real booking via existing booking flow
        BookingCreateRequest bookingRequest = new BookingCreateRequest();
        bookingRequest.setGarageId(waitlist.getGarageId());
        bookingRequest.setVehicleId(waitlist.getVehicleId());
        bookingRequest.setServicePackageId(waitlist.getServicePackageId());
        bookingRequest.setStartTime(waitlist.getDesiredStartTime());
        bookingRequest.setUsedPoints(0);

        // createBooking already enforces full capacity/tier/overlap validation —
        // if slot is no longer available, it throws and accept fails here.
        var bookingResponse = bookingService.createBooking(bookingRequest, customerId);

        waitlist.setStatus("ACCEPTED");
        waitlist.setAcceptedAt(LocalDateTime.now());
        waitlist.setOfferedBookingId(bookingResponse.getId());

        Waitlist saved = waitlistRepository.save(waitlist);
        return toResponse(saved);
    }

    // ===================== EXPIRE =====================

    @Override
    @Transactional
    public WaitlistResponse expireWaitlist(Long id, Long staffUserId, String role) {

        Waitlist waitlist = waitlistRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Waitlist not found: " + id));

        validateStaffScope(waitlist, staffUserId, role);

        if (!"WAITING".equals(waitlist.getStatus()) && !"OFFERED".equals(waitlist.getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Only WAITING or OFFERED waitlist entries can be expired. Current status: "
                            + waitlist.getStatus());
        }

        waitlist.setStatus("EXPIRED");
        waitlist.setExpiredAt(LocalDateTime.now());

        Waitlist saved = waitlistRepository.save(waitlist);
        return toResponse(saved);
    }

    // ===================== HELPERS =====================

    /**
     * Enforces that the caller is either ROLE_ADMIN or an active CUSTOMER_SERVICE_STAFF.
     * Returns the StaffProfile for ROLE_STAFF callers (non-null), or null for ROLE_ADMIN.
     * Throws 403 for any other role, inactive staff, or wrong staffType.
     */
    private StaffProfile requireCustomerServiceOrAdmin(Long staffUserId, String role) {
        if ("ROLE_ADMIN".equals(role)) {
            return null;
        }
        if (!"ROLE_STAFF".equals(role)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
        }
        StaffProfile staff = staffProfileRepository.findByUser_Id(staffUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Staff profile not found"));
        if (!Boolean.TRUE.equals(staff.getIsActive())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Staff profile is inactive");
        }
        if (staff.getStaffType() != StaffType.CUSTOMER_SERVICE_STAFF) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Only CUSTOMER_SERVICE_STAFF can manage waitlists");
        }
        return staff;
    }

    private void validateStaffScope(Waitlist waitlist, Long staffUserId, String role) {
        StaffProfile staff = requireCustomerServiceOrAdmin(staffUserId, role);
        // staff is null only for ROLE_ADMIN — admin is not restricted by garage
        if (staff != null && !staff.getGarageId().equals(waitlist.getGarageId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Staff can only manage waitlist entries in their assigned garage");
        }
    }

    private WaitlistResponse toResponse(Waitlist w) {
        return WaitlistResponse.builder()
                .id(w.getId())
                .garageId(w.getGarageId())
                .garageName(getGarageName(w.getGarageId()))
                .customerId(w.getCustomerId())
                .customerName(getUserName(w.getCustomerId()))
                .vehicleId(w.getVehicleId())
                .vehicleName(getVehicleName(w.getVehicleId()))
                .servicePackageId(w.getServicePackageId())
                .servicePackageName(getServicePackageName(w.getServicePackageId()))
                .offeredBookingId(w.getOfferedBookingId())
                .desiredStartTime(w.getDesiredStartTime())
                .desiredEndTime(w.getDesiredEndTime())
                .vehicleType(w.getVehicleType())
                .priorityLevel(w.getPriorityLevel())
                .customerTier(w.getCustomerTier())
                .status(w.getStatus())
                .reason(w.getReason())
                .offeredAt(w.getOfferedAt())
                .offerExpiresAt(w.getOfferExpiresAt())
                .acceptedAt(w.getAcceptedAt())
                .canceledAt(w.getCanceledAt())
                .expiredAt(w.getExpiredAt())
                .createdAt(w.getCreatedAt())
                .build();
    }

    private String getGarageName(Long garageId) {
        if (garageId == null) return null;

        return garageRepository.findById(garageId)
                .map(Garage::getName)
                .orElse(null);
    }

    private String getUserName(Long userId) {
        if (userId == null) return null;

        return userRepository.findById(userId)
                .map(User::getFullName)
                .orElse(null);
    }

    private String getServicePackageName(Long servicePackageId) {
        if (servicePackageId == null) return null;

        return servicePackageRepository.findById(servicePackageId)
                .map(ServicePackage::getName)
                .orElse(null);
    }

    private String getVehicleName(Long vehicleId) {
        if (vehicleId == null) return null;

        return vehicleRepository.findById(vehicleId)
                .map(this::formatVehicleName)
                .orElse(null);
    }

    private String formatVehicleName(Vehicle vehicle) {
        String licensePlate = vehicle.getRawLicensePlate();
        String brandModel = List.of(vehicle.getBrand(), vehicle.getModel()).stream()
                .filter(value -> value != null && !value.isBlank())
                .collect(Collectors.joining(" "));

        if (licensePlate != null && !licensePlate.isBlank() && !brandModel.isBlank()) {
            return licensePlate + " - " + brandModel;
        }

        if (licensePlate != null && !licensePlate.isBlank()) {
            return licensePlate;
        }

        return brandModel;
    }
}