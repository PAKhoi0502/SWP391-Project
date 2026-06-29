package com.autowashpro.service.impl;

import com.autowashpro.dto.response.WashHistoryResponse;
import com.autowashpro.entity.Booking;
import com.autowashpro.entity.WashHistory;
import com.autowashpro.repository.BookingRepository;
import com.autowashpro.repository.PointTransactionRepository;
import com.autowashpro.repository.WashHistoryRepository;
import com.autowashpro.service.WashHistoryService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

@Service
@RequiredArgsConstructor
public class WashHistoryServiceImpl implements WashHistoryService {

    private final WashHistoryRepository washHistoryRepository;
    private final BookingRepository bookingRepository;
    private final PointTransactionRepository pointTransactionRepository;

    @Override
    @Transactional
    public void createWashHistoryAfterPaidBooking(Long bookingId) {

        // Idempotent check
        if (washHistoryRepository.findByBookingId(bookingId).isPresent()) {
            return;
        }

        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new RuntimeException("Booking not found: " + bookingId));

        // Chỉ tạo khi COMPLETED + PAID
        if (!"COMPLETED".equals(booking.getStatus()) || !"PAID".equals(booking.getPaymentStatus())) {
            return;
        }

        // Guest booking không tạo wash history
        if (booking.getCustomerId() == null || booking.getVehicleId() == null) {
            return;
        }

        // Lấy earned points từ EARN transaction
        int earnedPoints = pointTransactionRepository
                .findByBookingIdAndType(bookingId, "EARN")
                .map(pt -> pt.getPoints())
                .orElse(0);

        WashHistory washHistory = new WashHistory();
        washHistory.setBookingId(bookingId);
        washHistory.setCustomerId(booking.getCustomerId());
        washHistory.setVehicleId(booking.getVehicleId());
        washHistory.setGarageId(booking.getGarageId());
        washHistory.setServicePackageId(booking.getServicePackageId());
        washHistory.setCompletedAt(booking.getCompletedAt());
        washHistory.setPaidAt(booking.getPaidAt());
        washHistory.setFinalPrice(booking.getFinalPrice());
        washHistory.setEarnedPoints(earnedPoints);

        washHistoryRepository.save(washHistory);
    }

    @Override
    public Page<WashHistoryResponse> getMyWashHistories(Long customerId, int page, int limit) {
        PageRequest pageable = PageRequest.of(page - 1, limit);
        return washHistoryRepository
                .findByCustomerIdOrderByCompletedAtDesc(customerId, pageable)
                .map(this::toResponse);
    }

    @Override
    public WashHistoryResponse getMyWashHistoryDetail(Long id, Long customerId) {
        WashHistory washHistory = washHistoryRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Wash history not found: " + id));

        if (!washHistory.getCustomerId().equals(customerId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "You cannot access this wash history");
        }

        return toResponse(washHistory);
    }

    @Override
    public Page<WashHistoryResponse> getAdminWashHistories(Long garageId, Long customerId, int page, int limit) {
        PageRequest pageable = PageRequest.of(page - 1, limit);

        if (garageId != null && customerId != null) {
            return washHistoryRepository
                    .findByCustomerIdAndGarageIdOrderByCompletedAtDesc(customerId, garageId, pageable)
                    .map(this::toResponse);
        } else if (garageId != null) {
            return washHistoryRepository
                    .findByGarageIdOrderByCompletedAtDesc(garageId, pageable)
                    .map(this::toResponse);
        } else if (customerId != null) {
            return washHistoryRepository
                    .findByCustomerIdOrderByCompletedAtDesc(customerId, pageable)
                    .map(this::toResponse);
        } else {
            return washHistoryRepository
                    .findAllByOrderByCompletedAtDesc(pageable)
                    .map(this::toResponse);
        }
    }

    private WashHistoryResponse toResponse(WashHistory w) {
        return WashHistoryResponse.builder()
                .id(w.getId())
                .bookingId(w.getBookingId())
                .customerId(w.getCustomerId())
                .vehicleId(w.getVehicleId())
                .garageId(w.getGarageId())
                .servicePackageId(w.getServicePackageId())
                .completedAt(w.getCompletedAt())
                .paidAt(w.getPaidAt())
                .finalPrice(w.getFinalPrice())
                .earnedPoints(w.getEarnedPoints())
                .createdAt(w.getCreatedAt())
                .build();
    }
}