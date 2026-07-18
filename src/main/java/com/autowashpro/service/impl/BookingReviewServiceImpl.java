package com.autowashpro.service.impl;

import com.autowashpro.dto.review.AdminReviewStatsResponse;
import com.autowashpro.dto.review.ReviewCreateRequest;
import com.autowashpro.dto.review.ReviewEligibilityResponse;
import com.autowashpro.dto.review.ReviewResponse;
import com.autowashpro.entity.Booking;
import com.autowashpro.entity.BookingReview;
import com.autowashpro.entity.BookingReviewImage;
import com.autowashpro.repository.BookingRepository;
import com.autowashpro.repository.BookingReviewImageRepository;
import com.autowashpro.repository.BookingReviewRepository;
import com.autowashpro.repository.GarageRepository;
import com.autowashpro.repository.NotificationRepository;
import com.autowashpro.repository.ServicePackageRepository;
import com.autowashpro.repository.UserRepository;
import com.autowashpro.service.BookingReviewService;
import com.autowashpro.service.NotificationService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class BookingReviewServiceImpl implements BookingReviewService {

    private final BookingReviewRepository bookingReviewRepository;
    private final BookingReviewImageRepository bookingReviewImageRepository;
    private final BookingRepository bookingRepository;
    private final NotificationRepository notificationRepository;
    private final NotificationService notificationService;
    private final UserRepository userRepository;
    private final GarageRepository garageRepository;
    private final ServicePackageRepository servicePackageRepository;

    @Override
    public ReviewEligibilityResponse checkEligibility(Long bookingId, Long customerId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Booking not found: " + bookingId));

        // Must belong to this customer
        if (!customerId.equals(booking.getCustomerId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "You cannot review this booking");
        }

        // Already reviewed?
        if (bookingReviewRepository.existsByBookingId(bookingId)) {
            BookingReview existing = bookingReviewRepository.findByBookingId(bookingId).orElse(null);
            ReviewResponse existingResponse = existing != null
                    ? buildReviewResponse(existing, booking)
                    : null;
            return ReviewEligibilityResponse.builder()
                    .eligible(false)
                    .alreadyReviewed(true)
                    .reason("You have already reviewed this booking")
                    .existingReview(existingResponse)
                    .build();
        }

        // Must be COMPLETED
        if (!"COMPLETED".equals(booking.getStatus())) {
            return ReviewEligibilityResponse.builder()
                    .eligible(false)
                    .alreadyReviewed(false)
                    .reason("Booking must be completed before you can leave a review")
                    .build();
        }

        // Must be PAID
        if (!"PAID".equals(booking.getPaymentStatus())) {
            return ReviewEligibilityResponse.builder()
                    .eligible(false)
                    .alreadyReviewed(false)
                    .reason("Booking must be fully paid before you can leave a review")
                    .build();
        }

        return ReviewEligibilityResponse.builder()
                .eligible(true)
                .alreadyReviewed(false)
                .build();
    }

    @Override
    @Transactional
    public ReviewResponse createReview(Long bookingId, Long customerId, ReviewCreateRequest request) {
        ReviewEligibilityResponse eligibility = checkEligibility(bookingId, customerId);
        if (!eligibility.isEligible()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    eligibility.getReason() != null ? eligibility.getReason() : "Not eligible to review");
        }

        Booking booking = bookingRepository.findById(bookingId).orElseThrow();

        BookingReview review = BookingReview.builder()
                .bookingId(bookingId)
                .customerId(customerId)
                .rating(request.getRating())
                .comment(request.getComment())
                .build();

        BookingReview saved = bookingReviewRepository.save(review);

        // Attach images if provided
        if (request.getImageUrls() != null && !request.getImageUrls().isEmpty()) {
            List<String> urls = request.getImageUrls().stream()
                    .filter(u -> u != null && !u.isBlank())
                    .limit(5)
                    .collect(Collectors.toList());

            for (int i = 0; i < urls.size(); i++) {
                BookingReviewImage img = BookingReviewImage.builder()
                        .review(saved)
                        .imageUrl(urls.get(i))
                        .displayOrder(i)
                        .build();
                bookingReviewImageRepository.save(img);
            }
            // Reload to pick up images
            saved = bookingReviewRepository.findById(saved.getId()).orElse(saved);
        }

        log.info("[REVIEW_CREATED] bookingId={}, customerId={}, rating={}", bookingId, customerId, request.getRating());
        return buildReviewResponse(saved, booking);
    }

    @Override
    public ReviewResponse getMyReview(Long bookingId, Long customerId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Booking not found: " + bookingId));

        if (!customerId.equals(booking.getCustomerId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "You cannot access this review");
        }

        BookingReview review = bookingReviewRepository.findByBookingId(bookingId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Review not found for booking: " + bookingId));

        return buildReviewResponse(review, booking);
    }

    @Override
    public Page<ReviewResponse> getAdminReviews(int page, int limit) {
        PageRequest pageable = PageRequest.of(page - 1, limit);
        return bookingReviewRepository.findAllByOrderByCreatedAtDesc(pageable)
                .map(review -> {
                    Booking booking = bookingRepository.findById(review.getBookingId()).orElse(null);
                    return buildReviewResponse(review, booking);
                });
    }

    @Override
    public AdminReviewStatsResponse getAdminStats() {
        List<BookingReview> all = bookingReviewRepository.findAll();
        long total = all.size();
        double avg = total == 0 ? 0.0
                : all.stream().mapToInt(BookingReview::getRating).average().orElse(0.0);

        // Build distribution 5 → 1 descending
        Map<Integer, Long> dist = new LinkedHashMap<>();
        for (int i = 5; i >= 1; i--) {
            final int r = i;
            dist.put(r, all.stream().filter(rev -> rev.getRating() == r).count());
        }

        return AdminReviewStatsResponse.builder()
                .averageRating(Math.round(avg * 10.0) / 10.0)
                .totalReviews(total)
                .ratingDistribution(dist)
                .build();
    }

    @Override
    public void maybeCreateReviewRequestNotification(Long bookingId) {
        try {
            Booking booking = bookingRepository.findById(bookingId).orElse(null);
            if (booking == null) return;
            if (booking.getCustomerId() == null) return;
            if (!"COMPLETED".equals(booking.getStatus())) return;
            if (!"PAID".equals(booking.getPaymentStatus())) return;

            // Duplicate guard
            if (notificationRepository.existsByBookingIdAndEventType(bookingId, "REVIEW_REQUEST")) {
                return;
            }

            notificationService.createInAppNotification(
                    booking.getCustomerId(),
                    bookingId,
                    "REVIEW_REQUEST",
                    "Rate your experience",
                    "How was your wash? Please rate our service for booking #" + bookingId + "."
            );

            log.info("[REVIEW_REQUEST_NOTIF] Sent review request for bookingId={}", bookingId);
        } catch (Exception e) {
            log.warn("[REVIEW_REQUEST_NOTIF] Failed to send review request notification for booking {}: {}",
                    bookingId, e.getMessage());
        }
    }

    @Override
    public Page<ReviewResponse> getPublicReviews(int page, int limit) {
        PageRequest pageable = PageRequest.of(Math.max(0, page - 1), Math.min(limit, 20));
        return bookingReviewRepository.findAllByOrderByCreatedAtDesc(pageable)
                .map(review -> {
                    Booking booking = bookingRepository.findById(review.getBookingId()).orElse(null);
                    return buildReviewResponse(review, booking);
                });
    }

    @Override
    public AdminReviewStatsResponse getPublicStats() {
        return getAdminStats();
    }

    // ── Helper ───────────────────────────────────────────────────────────────

    private ReviewResponse buildReviewResponse(BookingReview review, Booking booking) {
        String customerName = userRepository.findById(review.getCustomerId())
                .map(u -> u.getFullName())
                .orElse("Unknown");

        String garageName = null;
        String servicePackageName = null;

        if (booking != null) {
            if (booking.getGarageId() != null) {
                garageName = garageRepository.findById(booking.getGarageId())
                        .map(g -> g.getName())
                        .orElse(null);
            }
            if (booking.getServicePackageId() != null) {
                servicePackageName = servicePackageRepository.findById(booking.getServicePackageId())
                        .map(p -> p.getName())
                        .orElse(null);
            }
        }

        List<String> imageUrls = review.getImages() != null
                ? review.getImages().stream()
                        .map(BookingReviewImage::getImageUrl)
                        .collect(Collectors.toList())
                : List.of();

        return ReviewResponse.builder()
                .id(review.getId())
                .bookingId(review.getBookingId())
                .customerId(review.getCustomerId())
                .customerName(customerName)
                .rating(review.getRating())
                .comment(review.getComment())
                .imageUrls(imageUrls)
                .createdAt(review.getCreatedAt())
                .garageName(garageName)
                .servicePackageName(servicePackageName)
                .build();
    }
}
