package com.autowashpro.service.impl;

import com.autowashpro.dto.request.StaffProfileCreateRequest;
import com.autowashpro.dto.request.StaffProfileStatusUpdateRequest;
import com.autowashpro.dto.request.StaffProfileUpdateRequest;
import com.autowashpro.dto.response.CareBoardResponse;
import com.autowashpro.dto.response.CareTaskResponse;
import com.autowashpro.dto.response.PageResponse;
import com.autowashpro.dto.response.StaffCompletedServiceResponse;
import com.autowashpro.dto.response.StaffDashboardStatsResponse;
import com.autowashpro.dto.response.StaffProfileResponse;
import com.autowashpro.entity.Booking;
import com.autowashpro.entity.BookingAssignedStaff;
import com.autowashpro.entity.BookingServiceStep;
import com.autowashpro.entity.ServicePackage;
import com.autowashpro.entity.StaffProfile;
import com.autowashpro.entity.User;
import com.autowashpro.entity.WashBay;
import com.autowashpro.entity.enums.StaffType;
import com.autowashpro.repository.BookingAddOnServicePackageRepository;
import com.autowashpro.repository.BookingAssignedStaffRepository;
import com.autowashpro.repository.BookingRepository;
import com.autowashpro.repository.BookingServiceStepRepository;
import com.autowashpro.repository.GarageRepository;
import com.autowashpro.repository.ServicePackageRepository;
import com.autowashpro.repository.StaffProfileRepository;
import com.autowashpro.repository.UserRepository;
import com.autowashpro.repository.WashBayRepository;
import com.autowashpro.repository.spec.StaffProfileSpecifications;
import com.autowashpro.service.StaffProfileService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class StaffProfileServiceImpl implements StaffProfileService {

    private final StaffProfileRepository staffProfileRepository;
    private final UserRepository userRepository;
    private final GarageRepository garageRepository;
    private final BookingServiceStepRepository bookingServiceStepRepository;
    private final BookingRepository bookingRepository;
    private final BookingAddOnServicePackageRepository bookingAddOnServicePackageRepository;
    private final ServicePackageRepository servicePackageRepository;
    private final BookingAssignedStaffRepository bookingAssignedStaffRepository;
    private final WashBayRepository washBayRepository;

    @Override
    @Transactional
    public StaffProfileResponse create(StaffProfileCreateRequest request) {
        User user = userRepository.findById(request.getUserId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found: " + request.getUserId()));

        if (!"STAFF".equalsIgnoreCase(user.getRole())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "User must have STAFF role to own a staff profile");
        }

        if (staffProfileRepository.existsByUser_Id(user.getId())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This user already has a staff profile");
        }

        if (!garageRepository.existsById(request.getGarageId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid garage_id: " + request.getGarageId());
        }

        if (staffProfileRepository.existsByStaffCode(request.getStaffCode())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "staff_code already exists: " + request.getStaffCode());
        }

        StaffProfile profile = new StaffProfile();
        profile.setUser(user);
        profile.setGarageId(request.getGarageId());
        profile.setStaffCode(request.getStaffCode());
        profile.setStaffType(request.getStaffType());
        profile.setIsActive(true);
        profile.setSalary(request.getSalary() != null ? request.getSalary() : BigDecimal.ZERO);

        return toResponse(staffProfileRepository.save(profile));
    }

    @Override
    public StaffProfileResponse getById(Long id) {
        return toResponse(findOrThrow(id));
    }

    @Override
    public StaffProfileResponse getByUserId(Long userId) {
        StaffProfile profile = staffProfileRepository.findByUser_Id(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Staff profile not found for current user"));
        return toResponse(profile);
    }

    @Override
    @Transactional
    public StaffProfileResponse update(Long id, StaffProfileUpdateRequest request) {
        StaffProfile profile = findOrThrow(id);

        if (request.getGarageId() != null) {
            if (!garageRepository.existsById(request.getGarageId())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid garage_id: " + request.getGarageId());
            }
            profile.setGarageId(request.getGarageId());
        }

        if (request.getStaffType() != null) {
            profile.setStaffType(request.getStaffType());
        }

        if (request.getSalary() != null) {
            profile.setSalary(request.getSalary());
        }

        return toResponse(staffProfileRepository.save(profile));
    }

    @Override
    @Transactional
    public StaffProfileResponse updateStatus(Long id, StaffProfileStatusUpdateRequest request) {
        StaffProfile profile = findOrThrow(id);
        profile.setIsActive(request.getIsActive());
        return toResponse(staffProfileRepository.save(profile));
    }

    @Override
    public PageResponse<StaffProfileResponse> list(int page, int limit, Long garageId, StaffType staffType, Boolean isActive) {
        Specification<StaffProfile> spec = Specification
                .where(StaffProfileSpecifications.garageIdEquals(garageId))
                .and(StaffProfileSpecifications.staffTypeEquals(staffType))
                .and(StaffProfileSpecifications.isActiveEquals(isActive));

        Page<StaffProfile> result = staffProfileRepository.findAll(spec, PageRequest.of(Math.max(page - 1, 0), limit));

        return PageResponse.<StaffProfileResponse>builder()
                .data(result.getContent().stream().map(this::toResponse).collect(Collectors.toList()))
                .page(page)
                .limit(limit)
                .totalItems(result.getTotalElements())
                .totalPages(result.getTotalPages())
                .build();
    }

    @Override
    public void assertStaffCanOperateInGarage(Long userId, Long garageId) {
        StaffProfile profile = staffProfileRepository.findByUser_Id(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "No staff profile found for this user"));

        if (!Boolean.TRUE.equals(profile.getIsActive())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Staff profile is inactive");
        }

        if (!profile.getGarageId().equals(garageId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Staff cannot operate on a booking from another garage");
        }
    }

    @Override
    public StaffDashboardStatsResponse getMyDashboardStats(Long userId) {
        StaffProfile profile = staffProfileRepository.findByUser_Id(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Staff profile not found for current user"));

        List<Booking> completedBookings = myCompletedBookings(userId);

        LocalDate today = LocalDate.now();
        long todayCount = completedBookings.stream()
                .filter(b -> b.getCompletedAt() != null && b.getCompletedAt().toLocalDate().equals(today))
                .count();

        return StaffDashboardStatsResponse.builder()
                .totalCompletedServices(completedBookings.size())
                .todayCompletedServices(todayCount)
                .salary(profile.getSalary())
                .build();
    }

    @Override
    public List<StaffCompletedServiceResponse> getMyCompletedServices(Long userId, int limit) {
        return myCompletedBookings(userId).stream()
                .sorted(Comparator.comparing(Booking::getCompletedAt, Comparator.nullsLast(Comparator.reverseOrder())))
                .limit(Math.max(limit, 1))
                .map(booking -> StaffCompletedServiceResponse.builder()
                        .bookingId(booking.getId())
                        .completedAt(booking.getCompletedAt())
                        .servicePackageName(servicePackageName(booking.getServicePackageId()))
                        .addOnNames(bookingAddOnServicePackageRepository
                                .findByBookingIdOrderBySortOrderAsc(booking.getId()).stream()
                                .map(addOn -> servicePackageName(addOn.getServicePackageId()))
                                .filter(Objects::nonNull)
                                .toList())
                        .build())
                .toList();
    }

    private List<Booking> myCompletedBookings(Long userId) {
        Set<Long> bookingIds = bookingServiceStepRepository
                .findByCompletedByStaffIdAndStatus(userId, "COMPLETED").stream()
                .map(BookingServiceStep::getBookingId)
                .collect(Collectors.toSet());

        if (bookingIds.isEmpty()) {
            return List.of();
        }

        return bookingRepository.findAllById(bookingIds).stream()
                .filter(b -> "COMPLETED".equals(b.getStatus()))
                .toList();
    }

    private String servicePackageName(Long servicePackageId) {
        if (servicePackageId == null) return null;
        return servicePackageRepository.findById(servicePackageId)
                .map(ServicePackage::getName)
                .orElse(null);
    }

    @Override
    public CareBoardResponse getMyCareBoard(Long userId) {
        StaffProfile profile = staffProfileRepository.findByUser_Id(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Staff profile not found for current user"));

        List<CareTaskResponse> upcoming = bookingRepository
                .findByGarageIdAndStatusInOrderByStartTimeAsc(profile.getGarageId(), List.of("CONFIRMED", "CHECKED_IN")).stream()
                .filter(booking -> requiresCareStaffType(booking, profile.getStaffType()))
                .map(booking -> toCareTask(booking, null, "UPCOMING"))
                .toList();

        List<CareTaskResponse> waitingForCare = new ArrayList<>();
        List<CareTaskResponse> inCare = new ArrayList<>();

        for (BookingAssignedStaff assignment : bookingAssignedStaffRepository
                .findByStaffProfileIdAndStatus(profile.getId(), "ASSIGNED")) {

            Booking booking = bookingRepository.findById(assignment.getBookingId()).orElse(null);
            if (booking == null || !"IN_PROGRESS".equals(booking.getStatus())) {
                continue;
            }

            String careStatus = assignment.getCareStatus() != null ? assignment.getCareStatus() : "ASSIGNED";
            if ("IN_PROGRESS".equals(careStatus)) {
                inCare.add(toCareTask(booking, assignment, "IN_CARE"));
            } else if ("ASSIGNED".equals(careStatus)) {
                waitingForCare.add(toCareTask(booking, assignment, "WAITING_FOR_CARE"));
            }
        }

        return CareBoardResponse.builder()
                .upcoming(upcoming)
                .waitingForCare(waitingForCare)
                .inCare(inCare)
                .build();
    }

    @Override
    @Transactional
    public CareTaskResponse startCareTask(Long userId, Long assignmentId) {
        BookingAssignedStaff assignment = requireOwnedActiveAssignment(userId, assignmentId);

        if (!"ASSIGNED".equals(assignment.getCareStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Care task already started or completed");
        }

        assignment.setCareStatus("IN_PROGRESS");
        assignment.setCareStartedAt(LocalDateTime.now());
        bookingAssignedStaffRepository.save(assignment);

        Booking booking = bookingRepository.findById(assignment.getBookingId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found"));
        return toCareTask(booking, assignment, "IN_CARE");
    }

    @Override
    @Transactional
    public CareTaskResponse completeCareTask(Long userId, Long assignmentId) {
        BookingAssignedStaff assignment = requireOwnedActiveAssignment(userId, assignmentId);

        if (!"IN_PROGRESS".equals(assignment.getCareStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Care task is not in progress");
        }

        assignment.setCareStatus("DONE");
        assignment.setCareCompletedAt(LocalDateTime.now());
        bookingAssignedStaffRepository.save(assignment);

        Booking booking = bookingRepository.findById(assignment.getBookingId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found"));
        return toCareTask(booking, assignment, "DONE");
    }

    private BookingAssignedStaff requireOwnedActiveAssignment(Long userId, Long assignmentId) {
        StaffProfile profile = staffProfileRepository.findByUser_Id(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Staff profile not found for current user"));

        BookingAssignedStaff assignment = bookingAssignedStaffRepository.findById(assignmentId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Care task not found"));

        if (!assignment.getStaffProfileId().equals(profile.getId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "This care task is not assigned to you");
        }

        if (!"ASSIGNED".equals(assignment.getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "This assignment is no longer active");
        }

        return assignment;
    }

    private boolean requiresCareStaffType(Booking booking, StaffType staffType) {
        ServicePackage servicePackage = servicePackageRepository.findById(booking.getServicePackageId()).orElse(null);
        return servicePackage != null
                && Boolean.TRUE.equals(servicePackage.getRequiresCareStaff())
                && staffType.name().equals(servicePackage.getCareStaffType());
    }

    private CareTaskResponse toCareTask(Booking booking, BookingAssignedStaff assignment, String lane) {
        List<String> addOnNames = bookingAddOnServicePackageRepository
                .findByBookingIdOrderBySortOrderAsc(booking.getId()).stream()
                .map(addOn -> servicePackageName(addOn.getServicePackageId()))
                .filter(Objects::nonNull)
                .toList();

        List<String> tasks = bookingServiceStepRepository.findByBookingIdOrderByStepOrder(booking.getId()).stream()
                .filter(step -> !"COMPLETED".equals(step.getStatus()))
                .map(BookingServiceStep::getName)
                .toList();

        String previousWashBay = booking.getWashBayId() != null
                ? washBayRepository.findById(booking.getWashBayId()).map(WashBay::getBayCode).orElse(null)
                : null;

        return CareTaskResponse.builder()
                .bookingId(booking.getId())
                .assignmentId(assignment != null ? assignment.getId() : null)
                .licensePlate(booking.getLicensePlate())
                .servicePackageName(servicePackageName(booking.getServicePackageId()))
                .addOnNames(addOnNames)
                .tasks(tasks)
                .expectedStartTime(booking.getStartTime())
                .expectedEndTime(booking.getEndTime())
                .previousWashBay(previousWashBay)
                .lane(lane)
                .build();
    }

    private StaffProfile findOrThrow(Long id) {
        return staffProfileRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Staff profile not found: " + id));
    }

    private StaffProfileResponse toResponse(StaffProfile p) {
        return StaffProfileResponse.builder()
                .id(p.getId())
                .userId(p.getUser().getId())
                .userFullName(p.getUser().getFullName())
                .garageId(p.getGarageId())
                .staffCode(p.getStaffCode())
                .staffType(p.getStaffType())
                .isActive(p.getIsActive())
                .salary(p.getSalary())
                .createdAt(p.getCreatedAt())
                .updatedAt(p.getUpdatedAt())
                .build();
    }
}