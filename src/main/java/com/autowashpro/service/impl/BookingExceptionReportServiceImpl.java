package com.autowashpro.service.impl;

import com.autowashpro.dto.request.BookingExceptionReportCreateRequest;
import com.autowashpro.dto.request.UpdateExceptionReportStatusRequest;
import com.autowashpro.dto.response.BookingExceptionReportResponse;
import com.autowashpro.entity.Booking;
import com.autowashpro.entity.BookingExceptionReport;
import com.autowashpro.entity.BookingExceptionReportImage;
import com.autowashpro.entity.User;
import com.autowashpro.entity.Vehicle;
import com.autowashpro.repository.BookingExceptionReportRepository;
import com.autowashpro.repository.BookingRepository;
import com.autowashpro.repository.GarageRepository;
import com.autowashpro.repository.ServicePackageRepository;
import com.autowashpro.repository.UserRepository;
import com.autowashpro.repository.VehicleRepository;
import com.autowashpro.service.BookingExceptionReportService;
import com.autowashpro.service.VehicleInspectionService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Slf4j
@Service
@RequiredArgsConstructor
public class BookingExceptionReportServiceImpl implements BookingExceptionReportService {

    private static final Set<String> VALID_CATEGORIES =
            Set.of("VEHICLE_CONDITION", "SERVICE_QUALITY", "BILLING", "OTHER");
    private static final Set<String> VALID_STATUSES = Set.of("PENDING", "REVIEWED", "RESOLVED", "REJECTED");

    private final BookingExceptionReportRepository reportRepository;
    private final BookingRepository bookingRepository;
    private final UserRepository userRepository;
    private final GarageRepository garageRepository;
    private final ServicePackageRepository servicePackageRepository;
    private final VehicleRepository vehicleRepository;
    private final VehicleInspectionService vehicleInspectionService;

    @Override
    @Transactional
    public BookingExceptionReportResponse createReport(
            Long bookingId, Long customerId, BookingExceptionReportCreateRequest request) {

        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found: " + bookingId));

        if (!customerId.equals(booking.getCustomerId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "You cannot report this booking");
        }

        if (!"COMPLETED".equals(booking.getStatus())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "You can only report an issue after the service is completed");
        }

        if (reportRepository.existsByBookingId(bookingId)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "You have already reported this booking");
        }

        String category = request.getCategory() == null ? "" : request.getCategory().trim().toUpperCase();
        if (!VALID_CATEGORIES.contains(category)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Category must be one of: VEHICLE_CONDITION, SERVICE_QUALITY, BILLING, OTHER");
        }

        BookingExceptionReport report = BookingExceptionReport.builder()
                .bookingId(bookingId)
                .customerId(customerId)
                .category(category)
                .description(request.getDescription())
                .status("PENDING")
                .build();

        BookingExceptionReport saved = reportRepository.save(report);

        if (request.getImageUrls() != null && !request.getImageUrls().isEmpty()) {
            List<String> urls = request.getImageUrls().stream()
                    .filter(u -> u != null && !u.isBlank())
                    .limit(5)
                    .collect(Collectors.toList());

            for (int i = 0; i < urls.size(); i++) {
                saved.getImages().add(
                        BookingExceptionReportImage.builder()
                                .report(saved)
                                .imageUrl(urls.get(i))
                                .displayOrder(i)
                                .build());
            }
            saved = reportRepository.save(saved);
        }

        log.info("[EXCEPTION_REPORT_CREATED] bookingId={}, customerId={}, category={}", bookingId, customerId, category);
        return buildResponse(saved, booking, false);
    }

    @Override
    public List<BookingExceptionReportResponse> getMyReports(Long customerId) {
        return reportRepository.findByCustomerId(customerId).stream()
                .map(r -> buildResponse(r, bookingRepository.findById(r.getBookingId()).orElse(null), false))
                .collect(Collectors.toList());
    }

    @Override
    public Page<BookingExceptionReportResponse> getAdminReports(int page, int limit, String status, String category) {
        PageRequest pageable = PageRequest.of(Math.max(0, page - 1), limit);
        String normalizedStatus = normalizeFilter(status);
        String normalizedCategory = normalizeFilter(category);

        Page<BookingExceptionReport> reportPage;
        if (normalizedStatus != null && normalizedCategory != null) {
            reportPage = reportRepository.findByStatusAndCategoryOrderByCreatedAtDesc(normalizedStatus, normalizedCategory, pageable);
        } else if (normalizedStatus != null) {
            reportPage = reportRepository.findByStatusOrderByCreatedAtDesc(normalizedStatus, pageable);
        } else if (normalizedCategory != null) {
            reportPage = reportRepository.findByCategoryOrderByCreatedAtDesc(normalizedCategory, pageable);
        } else {
            reportPage = reportRepository.findAllByOrderByCreatedAtDesc(pageable);
        }

        return reportPage.map(r -> buildResponse(r, bookingRepository.findById(r.getBookingId()).orElse(null), false));
    }

    @Override
    public BookingExceptionReportResponse getAdminReportDetail(Long reportId) {
        BookingExceptionReport report = reportRepository.findById(reportId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Report not found: " + reportId));
        Booking booking = bookingRepository.findById(report.getBookingId()).orElse(null);
        return buildResponse(report, booking, true);
    }

    @Override
    @Transactional
    public BookingExceptionReportResponse updateStatus(Long reportId, UpdateExceptionReportStatusRequest request) {
        BookingExceptionReport report = reportRepository.findById(reportId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Report not found: " + reportId));

        String status = request.getStatus() == null ? "" : request.getStatus().trim().toUpperCase();
        if (!VALID_STATUSES.contains(status)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Status must be one of: PENDING, REVIEWED, RESOLVED, REJECTED");
        }

        report.setStatus(status);
        report.setAdminNote(request.getNote());
        BookingExceptionReport saved = reportRepository.save(report);
        Booking booking = bookingRepository.findById(saved.getBookingId()).orElse(null);
        return buildResponse(saved, booking, false);
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    private String normalizeFilter(String value) {
        if (value == null || value.isBlank() || "ALL".equalsIgnoreCase(value.trim())) return null;
        return value.trim().toUpperCase();
    }

    private BookingExceptionReportResponse buildResponse(BookingExceptionReport report, Booking booking, boolean includeStaffInspections) {
        User customer = userRepository.findById(report.getCustomerId()).orElse(null);

        String garageName = null;
        String servicePackageName = null;
        String vehicleName = null;
        String licensePlate = null;

        if (booking != null) {
            if (booking.getGarageId() != null) {
                garageName = garageRepository.findById(booking.getGarageId()).map(g -> g.getName()).orElse(null);
            }
            if (booking.getServicePackageId() != null) {
                servicePackageName = servicePackageRepository.findById(booking.getServicePackageId())
                        .map(p -> p.getName()).orElse(null);
            }
            licensePlate = booking.getLicensePlate();
            if (booking.getVehicleId() != null) {
                Vehicle vehicle = vehicleRepository.findById(booking.getVehicleId()).orElse(null);
                if (vehicle != null) {
                    if (licensePlate == null || licensePlate.isBlank()) {
                        licensePlate = vehicle.getRawLicensePlate();
                    }
                    vehicleName = Stream.of(vehicle.getBrand(), vehicle.getModel())
                            .filter(v -> v != null && !v.isBlank())
                            .collect(Collectors.joining(" "));
                }
            }
        }

        List<com.autowashpro.dto.response.VehicleInspectionResponse> staffInspections = null;
        if (includeStaffInspections && booking != null) {
            try {
                staffInspections = vehicleInspectionService.listByBooking(report.getBookingId(), report.getCustomerId(), "ROLE_ADMIN");
            } catch (Exception e) {
                log.warn("[EXCEPTION_REPORT_DETAIL] Failed to load staff inspections for bookingId={}: {}",
                        report.getBookingId(), e.getMessage());
                staffInspections = List.of();
            }
        }

        return BookingExceptionReportResponse.builder()
                .id(report.getId())
                .bookingId(report.getBookingId())
                .customerId(report.getCustomerId())
                .customerName(customer != null ? customer.getFullName() : "Unknown")
                .customerPhone(customer != null ? customer.getPhone() : null)
                .category(report.getCategory())
                .description(report.getDescription())
                .status(report.getStatus())
                .adminNote(report.getAdminNote())
                .imageUrls(report.getImages() != null
                        ? report.getImages().stream().map(BookingExceptionReportImage::getImageUrl).collect(Collectors.toList())
                        : List.of())
                .createdAt(report.getCreatedAt())
                .updatedAt(report.getUpdatedAt())
                .garageName(garageName)
                .servicePackageName(servicePackageName)
                .vehicleName(vehicleName)
                .licensePlate(licensePlate)
                .staffInspections(staffInspections)
                .build();
    }
}
