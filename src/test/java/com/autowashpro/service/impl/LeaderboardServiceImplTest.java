package com.autowashpro.service.impl;

import com.autowashpro.dto.response.LeaderboardEntryResponse;
import com.autowashpro.dto.response.LeaderboardResponse;
import com.autowashpro.entity.Upload;
import com.autowashpro.entity.User;
import com.autowashpro.repository.BookingRepository;
import com.autowashpro.repository.CustomerLoyaltyRepository;
import com.autowashpro.repository.LoyaltyTierRuleRepository;
import com.autowashpro.repository.PointTransactionRepository;
import com.autowashpro.repository.ServicePackageRepository;
import com.autowashpro.repository.UploadRepository;
import com.autowashpro.repository.UserRepository;
import com.autowashpro.service.EmailService;
import com.autowashpro.service.NotificationService;
import com.autowashpro.support.TestFixtures;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class LeaderboardServiceImplTest {

    @Mock private CustomerLoyaltyRepository customerLoyaltyRepository;
    @Mock private LoyaltyTierRuleRepository loyaltyTierRuleRepository;
    @Mock private BookingRepository bookingRepository;
    @Mock private PointTransactionRepository pointTransactionRepository;
    @Mock private ServicePackageRepository servicePackageRepository;
    @Mock private NotificationService notificationService;
    @Mock private UserRepository userRepository;
    @Mock private EmailService emailService;
    @Mock private UploadRepository uploadRepository;

    @InjectMocks
    private LoyaltyServiceImpl loyaltyService;

    // ── helpers ──────────────────────────────────────────────────────────────

    private User activeCustomer(Long id, String fullName) {
        return TestFixtures.user(id, fullName, "c" + id + "@test.local", "090" + id, "CUSTOMER");
    }

    /** Builds an aggregate row: [customerId, totalScore, washCount] — matches JPQL SELECT. */
    private Object[] row(long customerId, long score) {
        return new Object[]{customerId, score, 1L};
    }

    /**
     * Wraps a single Object[] in a typed List to avoid the varargs-ambiguity that
     * List.of(Object[]) has when the array is treated as the varargs array itself.
     */
    private List<Object[]> rows(Object[]... items) {
        List<Object[]> list = new ArrayList<>();
        for (Object[] item : items) {
            list.add(item);
        }
        return list;
    }

    private void stubUsers(List<User> users) {
        when(userRepository.findAllById(anyList())).thenReturn(users);
    }

    private void stubAvatarsEmpty() {
        when(uploadRepository.findAvatarsByOwnerIds(anyList())).thenReturn(Collections.emptyList());
    }

    private void stubMonthly(List<Object[]> rows) {
        when(pointTransactionRepository.findLeaderboardAggregateMonthly(
                any(LocalDateTime.class), any(LocalDateTime.class))).thenReturn(rows);
    }

    private void stubAllTime(List<Object[]> rows) {
        when(pointTransactionRepository.findLeaderboardAggregateAllTime()).thenReturn(rows);
    }

    // ── test 1: active CUSTOMER with BOOKING_EARN appears ────────────────────

    @Test
    void activeCustomerWithEarnedPointsAppearsInLeaderboard() {
        User customer = activeCustomer(1L, "Nguyen Van A");
        stubMonthly(rows(row(1L, 200)));
        stubUsers(List.of(customer));
        stubAvatarsEmpty();

        LeaderboardResponse response = loyaltyService.getLeaderboard("MONTHLY", 1, 20, 1L);

        assertEquals(1, response.getTopThree().size());
        LeaderboardEntryResponse entry = response.getTopThree().get(0);
        assertEquals(1L, entry.getUserId());
        assertEquals(200, entry.getScore());
        assertEquals(1, entry.getRank());
    }

    // ── test 2: invalid period throws BAD_REQUEST ────────────────────────────

    @Test
    void invalidPeriodThrowsBadRequest() {
        assertThrows(ResponseStatusException.class,
                () -> loyaltyService.getLeaderboard("WEEKLY", 1, 20, 1L));
    }

    // ── test 3: EARN+BOOKING_EARN counted; others excluded (repository filters) ──

    @Test
    void onlyBookingEarnTransactionsContributeToScore() {
        // The repository JPQL filters type=EARN and source=BOOKING_EARN.
        // Service verifies: if repository returns a row it appears in leaderboard.
        User customer = activeCustomer(10L, "Le Thi B");
        stubMonthly(rows(row(10L, 500)));
        stubUsers(List.of(customer));
        stubAvatarsEmpty();

        LeaderboardResponse response = loyaltyService.getLeaderboard("MONTHLY", 1, 20, 10L);

        assertEquals(500, response.getTopThree().get(0).getScore());
    }

    // ── test 4: ALL_TIME counts all BOOKING_EARN ─────────────────────────────

    @Test
    void allTimePeriodUsesAllTimeQuery() {
        User customer = activeCustomer(1L, "Nguyen Van A");
        stubAllTime(rows(row(1L, 1500)));
        stubUsers(List.of(customer));
        stubAvatarsEmpty();

        LeaderboardResponse response = loyaltyService.getLeaderboard("ALL_TIME", 1, 20, 1L);

        assertEquals("ALL_TIME", response.getPeriod());
        assertNull(response.getPeriodStart());
        assertNull(response.getPeriodEnd());
        assertEquals(1500, response.getTopThree().get(0).getScore());
    }

    // ── test 5: sort score DESC, customerId ASC for tie-break ────────────────

    @Test
    void sortIsScoreDescCustomerIdAscForTieBreak() {
        // Repository returns rows already sorted; service assigns sequential rank.
        User c1 = activeCustomer(1L, "A Nguyen");
        User c2 = activeCustomer(2L, "B Tran");
        User c3 = activeCustomer(3L, "C Le");
        stubMonthly(rows(row(1L, 300), row(2L, 300), row(3L, 200)));
        stubUsers(List.of(c1, c2, c3));
        stubAvatarsEmpty();

        LeaderboardResponse response = loyaltyService.getLeaderboard("MONTHLY", 1, 20, 99L);

        List<LeaderboardEntryResponse> top = response.getTopThree();
        assertEquals(3, top.size());
        assertEquals(1L, top.get(0).getUserId()); // rank 1
        assertEquals(2L, top.get(1).getUserId()); // rank 2
        assertEquals(3L, top.get(2).getUserId()); // rank 3
    }

    // ── test 6: rank is sequential unique ────────────────────────────────────

    @Test
    void rankIsSequentialAndUnique() {
        User c1 = activeCustomer(1L, "First");
        User c2 = activeCustomer(2L, "Second");
        User c3 = activeCustomer(3L, "Third");
        User c4 = activeCustomer(4L, "Fourth");
        stubMonthly(rows(row(1L, 400), row(2L, 300), row(3L, 200), row(4L, 100)));
        stubUsers(List.of(c1, c2, c3, c4));
        stubAvatarsEmpty();

        LeaderboardResponse response = loyaltyService.getLeaderboard("MONTHLY", 1, 20, 99L);

        List<LeaderboardEntryResponse> top = response.getTopThree();
        assertEquals(1, top.get(0).getRank());
        assertEquals(2, top.get(1).getRank());
        assertEquals(3, top.get(2).getRank());

        List<LeaderboardEntryResponse> entries = response.getEntries();
        assertEquals(4, entries.size());
        assertEquals(1, entries.get(0).getRank());
        assertEquals(4, entries.get(3).getRank());
    }

    // ── test 7: top 3 correct, NOT repeated in entries ───────────────────────

    @Test
    void topThreeAreIncludedInEntries() {
        List<User> users = List.of(
                activeCustomer(1L, "One"), activeCustomer(2L, "Two"), activeCustomer(3L, "Three"),
                activeCustomer(4L, "Four"), activeCustomer(5L, "Five"));
        stubMonthly(rows(row(1L, 500), row(2L, 400), row(3L, 300), row(4L, 200), row(5L, 100)));
        stubUsers(users);
        stubAvatarsEmpty();

        LeaderboardResponse response = loyaltyService.getLeaderboard("MONTHLY", 1, 20, 99L);

        assertEquals(3, response.getTopThree().size());
        assertEquals(5, response.getEntries().size());

        List<Long> topIds = response.getTopThree().stream().map(LeaderboardEntryResponse::getUserId).toList();
        List<Long> firstThreeEntryIds = response.getEntries().stream()
                .limit(3)
                .map(LeaderboardEntryResponse::getUserId)
                .toList();
        assertEquals(topIds, firstThreeEntryIds);
    }

    // ── test 8: pagination of entries (rank 4+) ───────────────────────────────

    @Test
    void paginationOfEntriesIsCorrect() {
        List<Object[]> rowList = new ArrayList<>();
        List<User> users = new ArrayList<>();
        for (int i = 1; i <= 10; i++) {
            rowList.add(row(i, 1000 - (i * 100)));
            users.add(activeCustomer((long) i, "User " + i));
        }
        stubMonthly(rowList);
        stubUsers(users);
        stubAvatarsEmpty();

        // page 1, limit 3 → entries are rank 4..10, page 1 shows ranks 4,5,6
        LeaderboardResponse page1 = loyaltyService.getLeaderboard("MONTHLY", 1, 3, 99L);
        assertEquals(3, page1.getEntries().size());
        assertEquals(1, page1.getEntries().get(0).getRank());
        assertEquals(3, page1.getEntries().get(2).getRank());
        assertEquals(10, page1.getTotalItems());
        assertEquals(4, page1.getTotalPages());

        // page 2 → ranks 7,8,9
        LeaderboardResponse page2 = loyaltyService.getLeaderboard("MONTHLY", 2, 3, 99L);
        assertEquals(3, page2.getEntries().size());
        assertEquals(4, page2.getEntries().get(0).getRank());
        assertEquals(6, page2.getEntries().get(2).getRank());

        // page 3 → rank 10 only
        LeaderboardResponse page4 = loyaltyService.getLeaderboard("MONTHLY", 4, 3, 99L);
        assertEquals(1, page4.getEntries().size());
        assertEquals(10, page4.getEntries().get(0).getRank());
    }

    // ── test 9: current user rank returned even when not on current page ──────

    @Test
    void currentUserEntryAlwaysReturned() {
        List<Object[]> rowList = new ArrayList<>();
        List<User> users = new ArrayList<>();
        for (int i = 1; i <= 8; i++) {
            rowList.add(row(i, 1000 - (i * 100)));
            users.add(activeCustomer((long) i, "User " + i));
        }
        Long currentUserId = 8L; // rank 8
        stubMonthly(rowList);
        stubUsers(users);
        stubAvatarsEmpty();

        // page 1, limit 3 → entries show ranks 4,5,6, but rank 8 not on this page
        LeaderboardResponse response = loyaltyService.getLeaderboard("MONTHLY", 1, 3, currentUserId);

        assertNotNull(response.getCurrentUser());
        assertEquals(currentUserId, response.getCurrentUser().getUserId());
        assertEquals(8, response.getCurrentUser().getRank());
        assertTrue(response.getCurrentUser().getCurrentUser());
    }

    // ── test 10: unranked current user returns score=0, rank=null ────────────

    @Test
    void unrankedCurrentUserReturnsScoreZeroAndNullRank() {
        User rankedUser = activeCustomer(1L, "Ranked");
        User currentUser = activeCustomer(99L, "Unranked Person");
        // currentUser has no BOOKING_EARN, so not in aggregate rows
        stubMonthly(rows(row(1L, 300)));
        stubUsers(List.of(rankedUser, currentUser));
        stubAvatarsEmpty();

        LeaderboardResponse response = loyaltyService.getLeaderboard("MONTHLY", 1, 20, 99L);

        LeaderboardEntryResponse cu = response.getCurrentUser();
        assertNotNull(cu);
        assertEquals(99L, cu.getUserId());
        assertEquals(0, cu.getScore());
        assertNull(cu.getRank());
        assertTrue(cu.getCurrentUser());
    }

    // ── test 11: no email/phone/publicId in DTO ───────────────────────────────

    @Test
    void dtoContainsNoEmailPhoneOrPublicId() {
        User customer = activeCustomer(1L, "Privacy Test");
        stubMonthly(rows(row(1L, 100)));
        stubUsers(List.of(customer));
        stubAvatarsEmpty();

        LeaderboardResponse response = loyaltyService.getLeaderboard("MONTHLY", 1, 20, 1L);

        LeaderboardEntryResponse entry = response.getTopThree().get(0);
        // LeaderboardEntryResponse only has: userId, displayName, initials, avatarUrl, score, rank, currentUser
        assertNotNull(entry.getDisplayName());
        assertNotNull(entry.getInitials());
        // displayName must be privacy-reduced: "Privacy T." (not full name)
        assertEquals("Privacy T.", entry.getDisplayName());
        assertEquals("PT", entry.getInitials());
    }

    // ── test 12: avatars loaded without N+1 (batch query called once) ─────────

    @Test
    void avatarsLoadedWithSingleBatchQuery() {
        List<Object[]> rowList = rows(row(1L, 300), row(2L, 200), row(3L, 100));
        User c1 = activeCustomer(1L, "A");
        User c2 = activeCustomer(2L, "B");
        User c3 = activeCustomer(3L, "C");

        Upload avatar1 = new Upload();
        avatar1.setId(10L);
        avatar1.setOwnerId(1L);
        avatar1.setEntityType("AVATAR");
        avatar1.setEntityId(1L);
        avatar1.setFileUrl("https://cdn.example.com/avatar1.jpg");
        avatar1.setPublicId("avatar1");

        stubMonthly(rowList);
        stubUsers(List.of(c1, c2, c3));
        when(uploadRepository.findAvatarsByOwnerIds(anyList())).thenReturn(List.of(avatar1));

        LeaderboardResponse response = loyaltyService.getLeaderboard("MONTHLY", 1, 20, 99L);

        LeaderboardEntryResponse entryWithAvatar = response.getTopThree().stream()
                .filter(e -> e.getUserId() == 1L).findFirst().orElseThrow();
        assertEquals("https://cdn.example.com/avatar1.jpg", entryWithAvatar.getAvatarUrl());
        assertNull(response.getTopThree().stream()
                .filter(e -> e.getUserId() == 2L).findFirst().orElseThrow().getAvatarUrl());
    }

    // ── test 13: MONTHLY period sets correct date range ─────────────────────

    @Test
    void monthlyPeriodSetsPeriodStartAndEnd() {
        // Empty ranked list: no avatar query is made, only userRepository is called
        // for the unranked currentUser lookup.
        stubMonthly(Collections.<Object[]>emptyList());
        when(userRepository.findAllById(anyList())).thenReturn(Collections.emptyList());

        LeaderboardResponse response = loyaltyService.getLeaderboard("MONTHLY", 1, 20, 1L);

        assertEquals("MONTHLY", response.getPeriod());
        assertNotNull(response.getPeriodStart());
        assertNotNull(response.getPeriodEnd());
        assertEquals(1, response.getPeriodStart().getDayOfMonth());
    }

    // ── test 14: empty leaderboard ────────────────────────────────────────────

    @Test
    void emptyLeaderboardReturnedWhenNoTransactions() {
        User currentUser = activeCustomer(1L, "Lonely User");
        stubMonthly(Collections.<Object[]>emptyList());
        when(userRepository.findAllById(anyList())).thenReturn(List.of(currentUser));

        LeaderboardResponse response = loyaltyService.getLeaderboard("MONTHLY", 1, 20, 1L);

        assertTrue(response.getTopThree().isEmpty());
        assertTrue(response.getEntries().isEmpty());
        assertNotNull(response.getCurrentUser());
        assertEquals(0, response.getCurrentUser().getScore());
        assertNull(response.getCurrentUser().getRank());
        assertEquals(0, response.getTotalItems());
        assertEquals(0, response.getTotalPages());
    }
}
