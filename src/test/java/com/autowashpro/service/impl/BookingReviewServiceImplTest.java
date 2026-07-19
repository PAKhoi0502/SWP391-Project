package com.autowashpro.service.impl;

import com.autowashpro.dto.review.PublicReviewResponse;
import com.autowashpro.dto.review.ReviewResponse;
import com.autowashpro.entity.Booking;
import com.autowashpro.entity.BookingReview;
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
import com.autowashpro.service.NotificationService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class BookingReviewServiceImplTest {

    @Mock BookingReviewRepository bookingReviewRepository;
    @Mock BookingReviewImageRepository bookingReviewImageRepository;
    @Mock BookingRepository bookingRepository;
    @Mock NotificationRepository notificationRepository;
    @Mock NotificationService notificationService;
    @Mock UserRepository userRepository;
    @Mock GarageRepository garageRepository;
    @Mock ServicePackageRepository servicePackageRepository;
    @Mock UploadRepository uploadRepository;
    @Mock PointTransactionRepository pointTransactionRepository;

    BookingReviewServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new BookingReviewServiceImpl(
                bookingReviewRepository, bookingReviewImageRepository, bookingRepository,
                notificationRepository, notificationService, userRepository,
                garageRepository, servicePackageRepository, uploadRepository,
                pointTransactionRepository);
    }

    // ── Public review response — privacy ─────────────────────────────────────

    @Test
    void getPublicReviews_masksDisplayName() {
        BookingReview review = reviewWithCustomer(10L, 100L);
        stubPageOf(review);
        stubUser(10L, "Hoàng Thanh");
        stubNoBooking(100L);
        stubNoAvatar();
        stubNoRank();

        Page<PublicReviewResponse> page = service.getPublicReviews(1, 10);

        assertThat(page.getContent()).hasSize(1);
        PublicReviewResponse r = page.getContent().get(0);
        assertThat(r.getDisplayName()).isEqualTo("Hoàng T.");
        assertThat(r.getInitials()).isEqualTo("HT");
    }

    @Test
    void getPublicReviews_doesNotExposeCustomerIdOrBookingId() {
        // PublicReviewResponse has no customerId or bookingId fields at all —
        // this test confirms the returned type cannot carry them
        BookingReview review = reviewWithCustomer(20L, 200L);
        stubPageOf(review);
        stubUser(20L, "Alice");
        stubNoBooking(200L);
        stubNoAvatar();
        stubNoRank();

        Page<PublicReviewResponse> page = service.getPublicReviews(1, 10);

        PublicReviewResponse r = page.getContent().get(0);
        // PublicReviewResponse has no customerId / bookingId field — would be compile error
        assertThat(r.getDisplayName()).isEqualTo("Alice");   // single word: kept as-is
        assertThat(r.getInitials()).isEqualTo("A");
    }

    @Test
    void getPublicReviews_returnsAvatarUrl() {
        BookingReview review = reviewWithCustomer(30L, 300L);
        stubPageOf(review);
        stubUser(30L, "Bob Builder");
        stubNoBooking(300L);

        Upload upload = new Upload();
        upload.setOwnerId(30L);
        upload.setFileUrl("https://cdn.example.com/avatars/bob.jpg");
        when(uploadRepository.findAvatarsByOwnerIds(anyList())).thenReturn(List.of(upload));
        stubNoRank();

        Page<PublicReviewResponse> page = service.getPublicReviews(1, 10);

        assertThat(page.getContent().get(0).getAvatarUrl())
                .isEqualTo("https://cdn.example.com/avatars/bob.jpg");
    }

    @Test
    void getPublicReviews_returnsLeaderboardRank() {
        BookingReview review = reviewWithCustomer(40L, 400L);
        stubPageOf(review);
        stubUser(40L, "Top Racer");
        stubNoBooking(400L);
        stubNoAvatar();

        // Simulate: customerId=40 is rank 3 (position in aggregate list)
        Object[] row1 = new Object[]{99L, 5000L, 10L};
        Object[] row2 = new Object[]{88L, 3000L, 7L};
        Object[] row3 = new Object[]{40L, 1500L, 4L};
        when(pointTransactionRepository.findLeaderboardAggregateAllTime())
                .thenReturn(List.<Object[]>of(row1, row2, row3));

        Page<PublicReviewResponse> page = service.getPublicReviews(1, 10);

        assertThat(page.getContent().get(0).getLeaderboardRank()).isEqualTo(3);
    }

    @Test
    void getPublicReviews_unrankedCustomerHasNullRank() {
        BookingReview review = reviewWithCustomer(50L, 500L);
        stubPageOf(review);
        stubUser(50L, "New Customer");
        stubNoBooking(500L);
        stubNoAvatar();

        // customerId=50 not in aggregate results
        Object[] row1 = new Object[]{99L, 5000L, 10L};
        when(pointTransactionRepository.findLeaderboardAggregateAllTime())
                .thenReturn(List.<Object[]>of(row1));

        Page<PublicReviewResponse> page = service.getPublicReviews(1, 10);

        assertThat(page.getContent().get(0).getLeaderboardRank()).isNull();
    }

    @Test
    void getPublicReviews_singleWordNameKeptAsIs() {
        BookingReview review = reviewWithCustomer(60L, 600L);
        stubPageOf(review);
        stubUser(60L, "Cher");
        stubNoBooking(600L);
        stubNoAvatar();
        stubNoRank();

        Page<PublicReviewResponse> page = service.getPublicReviews(1, 10);

        assertThat(page.getContent().get(0).getDisplayName()).isEqualTo("Cher");
        assertThat(page.getContent().get(0).getInitials()).isEqualTo("C");
    }

    // ── Admin review response — full data with avatar ─────────────────────────

    @Test
    void getAdminReviews_returnsFullCustomerName() {
        BookingReview review = reviewWithCustomer(70L, 700L);
        stubPageOf(review);
        stubUser(70L, "Nguyễn Văn An");
        stubNoBooking(700L);
        stubNoAvatar();

        Page<ReviewResponse> page = service.getAdminReviews(1, 20);

        ReviewResponse r = page.getContent().get(0);
        assertThat(r.getCustomerName()).isEqualTo("Nguyễn Văn An");
        assertThat(r.getCustomerId()).isEqualTo(70L);
        assertThat(r.getBookingId()).isEqualTo(700L);
    }

    @Test
    void getAdminReviews_returnsAvatarUrl() {
        BookingReview review = reviewWithCustomer(80L, 800L);
        stubPageOf(review);
        stubUser(80L, "Admin Test");
        stubNoBooking(800L);

        Upload upload = new Upload();
        upload.setOwnerId(80L);
        upload.setFileUrl("https://cdn.example.com/avatars/admin.jpg");
        when(uploadRepository.findAvatarsByOwnerIds(anyList())).thenReturn(List.of(upload));

        Page<ReviewResponse> page = service.getAdminReviews(1, 20);

        assertThat(page.getContent().get(0).getAvatarUrl())
                .isEqualTo("https://cdn.example.com/avatars/admin.jpg");
    }

    // ── No N+1: batch loading uses a single avatar query per page ────────────

    @Test
    void getPublicReviews_batchLoadsAvatars_notPerReview() {
        // Three reviews, three customers — should call findAvatarsByOwnerIds exactly once
        BookingReview r1 = reviewWithCustomer(11L, 111L);
        BookingReview r2 = reviewWithCustomer(22L, 222L);
        BookingReview r3 = reviewWithCustomer(33L, 333L);

        PageImpl<BookingReview> reviewPage = new PageImpl<>(List.of(r1, r2, r3),
                PageRequest.of(0, 10), 3);
        when(bookingReviewRepository.findAllByOrderByCreatedAtDesc(any())).thenReturn(reviewPage);

        when(userRepository.findAllById(anyList())).thenReturn(List.of(
                userOf(11L, "A B"), userOf(22L, "C D"), userOf(33L, "E F")));
        when(bookingRepository.findAllById(anyList())).thenReturn(List.of());
        when(uploadRepository.findAvatarsByOwnerIds(anyList())).thenReturn(List.of());
        when(pointTransactionRepository.findLeaderboardAggregateAllTime()).thenReturn(List.of());
        when(garageRepository.findAllById(anyList())).thenReturn(List.of());
        when(servicePackageRepository.findAllById(anyList())).thenReturn(List.of());

        service.getPublicReviews(1, 10);

        // Exactly one batch call — no per-review avatar query
        verify(uploadRepository, times(1)).findAvatarsByOwnerIds(anyList());
    }

    // ── Null / blank name falls back gracefully ───────────────────────────────

    @Test
    void getPublicReviews_nullNameFallsBackToCustomer() {
        BookingReview review = reviewWithCustomer(90L, 900L);
        stubPageOf(review);
        stubUser(90L, null);
        stubNoBooking(900L);
        stubNoAvatar();
        stubNoRank();

        Page<PublicReviewResponse> page = service.getPublicReviews(1, 10);

        PublicReviewResponse r = page.getContent().get(0);
        assertThat(r.getDisplayName()).isEqualTo("Customer");
        assertThat(r.getInitials()).isEqualTo("U");
    }

    // ── Public endpoint accessible without authentication ─────────────────────
    // (SecurityConfig is not tested here; this just confirms the service method is public)

    @Test
    void getPublicReviews_returnsEmptyPageWhenNoReviews() {
        when(bookingReviewRepository.findAllByOrderByCreatedAtDesc(any()))
                .thenReturn(new PageImpl<>(List.of()));

        Page<PublicReviewResponse> page = service.getPublicReviews(1, 10);

        assertThat(page.getContent()).isEmpty();
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private BookingReview reviewWithCustomer(Long customerId, Long bookingId) {
        BookingReview r = new BookingReview();
        r.setId(customerId * 10);
        r.setCustomerId(customerId);
        r.setBookingId(bookingId);
        r.setRating(5);
        r.setComment("Great service!");
        r.setCreatedAt(LocalDateTime.now());
        return r;
    }

    private User userOf(Long id, String fullName) {
        User u = new User();
        u.setId(id);
        u.setFullName(fullName);
        return u;
    }

    private void stubPageOf(BookingReview review) {
        PageImpl<BookingReview> p = new PageImpl<>(List.of(review), PageRequest.of(0, 10), 1);
        when(bookingReviewRepository.findAllByOrderByCreatedAtDesc(any())).thenReturn(p);
    }

    private void stubUser(Long id, String name) {
        when(userRepository.findAllById(anyList())).thenReturn(List.of(userOf(id, name)));
    }

    private void stubNoBooking(Long bookingId) {
        when(bookingRepository.findAllById(anyList())).thenReturn(List.of());
        when(garageRepository.findAllById(anyList())).thenReturn(List.of());
        when(servicePackageRepository.findAllById(anyList())).thenReturn(List.of());
    }

    private void stubNoAvatar() {
        when(uploadRepository.findAvatarsByOwnerIds(anyList())).thenReturn(List.of());
    }

    private void stubNoRank() {
        when(pointTransactionRepository.findLeaderboardAggregateAllTime())
                .thenReturn(List.<Object[]>of());
    }
}
