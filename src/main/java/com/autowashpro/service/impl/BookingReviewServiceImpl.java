package com.autowashpro.service.impl;

import com.autowashpro.dto.review.AdminReviewStatsResponse;
import com.autowashpro.dto.review.PublicReviewResponse;
import com.autowashpro.dto.review.ReviewCreateRequest;
import com.autowashpro.dto.review.ReviewEligibilityResponse;
import com.autowashpro.dto.review.ReviewResponse;
import com.autowashpro.entity.Booking;
import com.autowashpro.entity.BookingReview;
import com.autowashpro.entity.BookingReviewImage;
import com.autowashpro.entity.Upload;
import com.autowashpro.entity.User;
import com.autowashpro.repository.BookingRepository;
import com.autowashpro.repository.BookingReviewImageRepository;
import com.autowashpro.repository.BookingReviewRepository;
import com.autowashpro.repository.GarageRepository;
import com.autowashpro.repository.NotificationRepository;
import com.autowashpro.repository.PointTransactionRepository;
import com.autowashpro.repository.ServicePackageRepository;
import com.autowashpro.repository.UploadRepository;
import com.autowashpro.repository.UserRepository;
import com.autowashpro.service.BookingReviewService;
import com.autowashpro.service.NotificationService;
import com.autowashpro.util.DisplayNameHelper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
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
    private final UploadRepository uploadRepository;
    private final PointTransactionRepository pointTransactionRepository;

    @Override
    public ReviewEligibilityResponse checkEligibility(Long bookingId, Long customerId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Booking not found: " + bookingId));

        if (!customerId.equals(booking.getCustomerId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "You cannot review this booking");
        }

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

        if (!"COMPLETED".equals(booking.getStatus())) {
            return ReviewEligibilityResponse.builder()
                    .eligible(false)
                    .alreadyReviewed(false)
                    .reason("Booking must be completed before you can leave a review")
                    .build();
        }

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

    // ── Admin reviews — batch-loaded, full PII, with avatar ──────────────────

    @Override
    public Page<ReviewResponse> getAdminReviews(int page, int limit) {
        PageRequest pageable = PageRequest.of(Math.max(0, page - 1), limit);
        Page<BookingReview> reviewPage = bookingReviewRepository.findAllByOrderByCreatedAtDesc(pageable);
        List<BookingReview> reviews = reviewPage.getContent();

        if (reviews.isEmpty()) return reviewPage.map(r -> buildReviewResponse(r, null));

        // Batch-load bookings
        List<Long> bookingIds = reviews.stream().map(BookingReview::getBookingId)
                .filter(Objects::nonNull).distinct().collect(Collectors.toList());
        Map<Long, Booking> bookingMap = bookingRepository.findAllById(bookingIds).stream()
                .collect(Collectors.toMap(Booking::getId, b -> b));

        // Batch-load users
        List<Long> customerIds = reviews.stream().map(BookingReview::getCustomerId)
                .filter(Objects::nonNull).distinct().collect(Collectors.toList());
        Map<Long, User> userMap = userRepository.findAllById(customerIds).stream()
                .collect(Collectors.toMap(User::getId, u -> u));

        // Batch-load avatars
        Map<Long, String> avatarMap = batchLoadAvatars(customerIds);

        // Batch-load garages
        List<Long> garageIds = bookingMap.values().stream().map(Booking::getGarageId)
                .filter(Objects::nonNull).distinct().collect(Collectors.toList());
        Map<Long, String> garageNameMap = garageRepository.findAllById(garageIds).stream()
                .collect(Collectors.toMap(g -> g.getId(), g -> g.getName()));

        // Batch-load service packages
        List<Long> packageIds = bookingMap.values().stream().map(Booking::getServicePackageId)
                .filter(Objects::nonNull).distinct().collect(Collectors.toList());
        Map<Long, String> packageNameMap = servicePackageRepository.findAllById(packageIds).stream()
                .collect(Collectors.toMap(p -> p.getId(), p -> p.getName()));

        return reviewPage.map(review -> {
            User user = userMap.get(review.getCustomerId());
            Booking booking = bookingMap.get(review.getBookingId());
            List<String> imageUrls = extractImageUrls(review);
            return ReviewResponse.builder()
                    .id(review.getId())
                    .bookingId(review.getBookingId())
                    .customerId(review.getCustomerId())
                    .customerName(user != null ? user.getFullName() : "Unknown")
                    .avatarUrl(avatarMap.get(review.getCustomerId()))
                    .initials(DisplayNameHelper.buildInitials(user != null ? user.getFullName() : null))
                    .rating(review.getRating())
                    .comment(review.getComment())
                    .imageUrls(imageUrls)
                    .createdAt(review.getCreatedAt())
                    .garageName(booking != null && booking.getGarageId() != null
                            ? garageNameMap.get(booking.getGarageId()) : null)
                    .servicePackageName(booking != null && booking.getServicePackageId() != null
                            ? packageNameMap.get(booking.getServicePackageId()) : null)
                    .build();
        });
    }

    // ── Public reviews — masked PII, with avatar and leaderboard rank ─────────

    @Override
    public Page<PublicReviewResponse> getPublicReviews(int page, int limit) {
        PageRequest pageable = PageRequest.of(Math.max(0, page - 1), Math.min(limit, 20));
        Page<BookingReview> reviewPage = bookingReviewRepository.findAllByOrderByCreatedAtDesc(pageable);
        List<BookingReview> reviews = reviewPage.getContent();

        if (reviews.isEmpty()) {
            return reviewPage.map(r -> PublicReviewResponse.builder().build());
        }

        // Batch-load bookings
        List<Long> bookingIds = reviews.stream().map(BookingReview::getBookingId)
                .filter(Objects::nonNull).distinct().collect(Collectors.toList());
        Map<Long, Booking> bookingMap = bookingRepository.findAllById(bookingIds).stream()
                .collect(Collectors.toMap(Booking::getId, b -> b));

        // Batch-load users
        List<Long> customerIds = reviews.stream().map(BookingReview::getCustomerId)
                .filter(Objects::nonNull).distinct().collect(Collectors.toList());
        Map<Long, User> userMap = userRepository.findAllById(customerIds).stream()
                .collect(Collectors.toMap(User::getId, u -> u));

        // Batch-load avatars
        Map<Long, String> avatarMap = batchLoadAvatars(customerIds);

        // Batch-load garages
        List<Long> garageIds = bookingMap.values().stream().map(Booking::getGarageId)
                .filter(Objects::nonNull).distinct().collect(Collectors.toList());
        Map<Long, String> garageNameMap = garageRepository.findAllById(garageIds).stream()
                .collect(Collectors.toMap(g -> g.getId(), g -> g.getName()));

        // Batch-load service packages
        List<Long> packageIds = bookingMap.values().stream().map(Booking::getServicePackageId)
                .filter(Objects::nonNull).distinct().collect(Collectors.toList());
        Map<Long, String> packageNameMap = servicePackageRepository.findAllById(packageIds).stream()
                .collect(Collectors.toMap(p -> p.getId(), p -> p.getName()));

        // Compute all-time leaderboard ranks for page customers only (1 query total)
        Map<Long, Integer> rankMap = computeAllTimeRanks(customerIds);

        return reviewPage.map(review -> {
            User user = userMap.get(review.getCustomerId());
            String fullName = user != null ? user.getFullName() : null;
            Booking booking = bookingMap.get(review.getBookingId());
            List<String> imageUrls = extractImageUrls(review);
            return PublicReviewResponse.builder()
                    .id(review.getId())
                    .displayName(DisplayNameHelper.buildDisplayName(fullName))
                    .initials(DisplayNameHelper.buildInitials(fullName))
                    .avatarUrl(avatarMap.get(review.getCustomerId()))
                    .leaderboardRank(rankMap.get(review.getCustomerId()))
                    .rating(review.getRating())
                    .comment(review.getComment())
                    .imageUrls(imageUrls)
                    .createdAt(review.getCreatedAt())
                    .garageName(booking != null && booking.getGarageId() != null
                            ? garageNameMap.get(booking.getGarageId()) : null)
                    .servicePackageName(booking != null && booking.getServicePackageId() != null
                            ? packageNameMap.get(booking.getServicePackageId()) : null)
                    .build();
        });
    }

    @Override
    public AdminReviewStatsResponse getAdminStats() {
        List<BookingReview> all = bookingReviewRepository.findAll();
        long total = all.size();
        double avg = total == 0 ? 0.0
                : all.stream().mapToInt(BookingReview::getRating).average().orElse(0.0);

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
    public AdminReviewStatsResponse getPublicStats() {
        return getAdminStats();
    }

    @Override
    public void maybeCreateReviewRequestNotification(Long bookingId) {
        try {
            Booking booking = bookingRepository.findById(bookingId).orElse(null);
            if (booking == null) return;
            if (booking.getCustomerId() == null) return;
            if (!"COMPLETED".equals(booking.getStatus())) return;
            if (!"PAID".equals(booking.getPaymentStatus())) return;

            if (notificationRepository.existsByBookingIdAndEventType(bookingId, "REVIEW_REQUEST")) {
                return;
            }

            long customerBookingNumber = bookingRepository
                    .countByCustomerIdAndIdLessThanEqual(booking.getCustomerId(), bookingId);
            notificationService.createInAppNotification(
                    booking.getCustomerId(),
                    bookingId,
                    "REVIEW_REQUEST",
                    "Rate your experience",
                    "How was your wash? Please rate our service for booking #"
                            + customerBookingNumber + "."
            );

            log.info("[REVIEW_REQUEST_NOTIF] Sent review request for bookingId={}", bookingId);
        } catch (Exception e) {
            log.warn("[REVIEW_REQUEST_NOTIF] Failed to send review request notification for booking {}: {}",
                    bookingId, e.getMessage());
        }
    }

    @Override
    public List<Long> getMyReviewedBookingIds(Long customerId) {
        return bookingReviewRepository.findByCustomerId(customerId)
                .stream()
                .map(BookingReview::getBookingId)
                .toList();
    }

    // ── Private helpers ───────────────────────────────────────────────────────

    /** Builds ReviewResponse for single-review operations (eligibility check, create, getMyReview). */
    private ReviewResponse buildReviewResponse(BookingReview review, Booking booking) {
        String customerName = userRepository.findById(review.getCustomerId())
                .map(User::getFullName)
                .orElse("Unknown");

        String garageName = null;
        String servicePackageName = null;

        if (booking != null) {
            if (booking.getGarageId() != null) {
                garageName = garageRepository.findById(booking.getGarageId())
                        .map(g -> g.getName()).orElse(null);
            }
            if (booking.getServicePackageId() != null) {
                servicePackageName = servicePackageRepository.findById(booking.getServicePackageId())
                        .map(p -> p.getName()).orElse(null);
            }
        }

        return ReviewResponse.builder()
                .id(review.getId())
                .bookingId(review.getBookingId())
                .customerId(review.getCustomerId())
                .customerName(customerName)
                .initials(DisplayNameHelper.buildInitials(customerName))
                .rating(review.getRating())
                .comment(review.getComment())
                .imageUrls(extractImageUrls(review))
                .createdAt(review.getCreatedAt())
                .garageName(garageName)
                .servicePackageName(servicePackageName)
                .build();
    }

    /** Batch-loads latest avatar URL per owner from uploads system. */
    private Map<Long, String> batchLoadAvatars(List<Long> ownerIds) {
        if (ownerIds.isEmpty()) return new HashMap<>();
        List<Upload> uploads = uploadRepository.findAvatarsByOwnerIds(ownerIds);
        // findAvatarsByOwnerIds orders by id DESC — first occurrence per owner is the latest
        Map<Long, String> map = new HashMap<>();
        for (Upload u : uploads) {
            map.putIfAbsent(u.getOwnerId(), u.getFileUrl());
        }
        return map;
    }

    /** Extracts review image URLs from the entity's images collection. */
    private List<String> extractImageUrls(BookingReview review) {
        return review.getImages() != null
                ? review.getImages().stream()
                        .map(BookingReviewImage::getImageUrl)
                        .collect(Collectors.toList())
                : List.of();
    }

    /**
     * Computes all-time leaderboard ranks for a specific set of customers.
     * Runs one aggregate query over all point transactions; O(1) per customer lookup.
     */
    private Map<Long, Integer> computeAllTimeRanks(List<Long> customerIds) {
        if (customerIds.isEmpty()) return new HashMap<>();
        Set<Long> target = new HashSet<>(customerIds);
        List<Object[]> rows = pointTransactionRepository.findLeaderboardAggregateAllTime();
        Map<Long, Integer> rankMap = new HashMap<>();
        int rank = 1;
        for (Object[] row : rows) {
            long cid = ((Number) row[0]).longValue();
            if (target.contains(cid)) {
                rankMap.put(cid, rank);
            }
            rank++;
        }
        return rankMap;
    }
}
