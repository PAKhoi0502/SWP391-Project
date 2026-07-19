package com.autowashpro.service.impl;

import com.autowashpro.dto.response.LeaderboardEntryResponse;
import com.autowashpro.dto.response.LeaderboardResponse;
import com.autowashpro.dto.response.LoyaltyOverviewResponse;
import com.autowashpro.dto.response.LoyaltyTierRuleResponse;
import com.autowashpro.entity.CustomerLoyalty;
import com.autowashpro.entity.LoyaltyTierRule;
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
import com.autowashpro.service.LoyaltyPointExpiryService;
import com.autowashpro.service.LoyaltyService;
import com.autowashpro.service.NotificationService;
import com.autowashpro.util.DisplayNameHelper;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.YearMonth;
import java.time.ZoneId;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import com.autowashpro.entity.Booking;
import com.autowashpro.dto.request.CreateLoyaltyTierRuleRequest;
import com.autowashpro.dto.request.UpdateLoyaltyTierRuleRequest;
import com.autowashpro.dto.request.RedeemPreviewRequest;
import com.autowashpro.dto.response.PointTransactionResponse;
import com.autowashpro.dto.response.RedeemPreviewResponse;
import com.autowashpro.entity.PointTransaction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.transaction.annotation.Transactional;
import java.math.RoundingMode;

@Service
@RequiredArgsConstructor
public class LoyaltyServiceImpl implements LoyaltyService {
    private final CustomerLoyaltyRepository customerLoyaltyRepository;
    private final LoyaltyTierRuleRepository loyaltyTierRuleRepository;
    private final BookingRepository bookingRepository;
    private final PointTransactionRepository pointTransactionRepository;
    private final ServicePackageRepository servicePackageRepository;
    private final NotificationService notificationService;
    private final UserRepository userRepository;
    private final EmailService emailService;
    private final UploadRepository uploadRepository;
    private final LoyaltyPointExpiryService loyaltyPointExpiryService;

    @Value("${loyalty.points.expiry-months:6}")
    private int expiryMonths;

    @Override
    public CustomerLoyalty getOrCreateCustomerLoyalty(Long customerId) {
        return customerLoyaltyRepository.findByCustomerId(customerId).orElseGet(() -> {
            CustomerLoyalty loyalty = new CustomerLoyalty();
            loyalty.setCustomerId(customerId);
            // "NEW" = not yet ranked; customer is promoted to BRONZE after their first completed+paid booking.
            loyalty.setCurrentTier("NEW");
            loyalty.setTotalPoints(0);
            loyalty.setAvailablePoints(0);
            loyalty.setRedeemedPoints(0);
            loyalty.setExpiredPoints(0);
            loyalty.setTotalSpent(BigDecimal.ZERO);
            loyalty.setTotalVisits(0);
            loyalty.setCurrentCycleSpent(BigDecimal.ZERO);
            loyalty.setCurrentCycleVisits(0);
            return customerLoyaltyRepository.save(loyalty);
        });
    }

    @Override
    public LoyaltyOverviewResponse getMyLoyalty(Long customerId) {
        loyaltyPointExpiryService.expireForCustomer(customerId);
        backfillMissingEarnPoints(customerId);
        CustomerLoyalty loyalty = getOrCreateCustomerLoyalty(customerId);

        // Compute next-expiry info from active lots
        LocalDateTime now = LocalDateTime.now();
        List<com.autowashpro.entity.PointTransaction> activeLots =
                pointTransactionRepository.findActiveCreditLotsForFifo(customerId, now);

        LocalDateTime nextExpiryAt = null;
        int nextExpiringPoints = 0;
        for (com.autowashpro.entity.PointTransaction lot : activeLots) {
            if (lot.getExpiredAt() == null) continue;
            if (nextExpiryAt == null) {
                nextExpiryAt = lot.getExpiredAt();
                nextExpiringPoints = lot.getRemainingPoints();
            } else if (lot.getExpiredAt().isEqual(nextExpiryAt)) {
                nextExpiringPoints += lot.getRemainingPoints();
            } else {
                break; // findActiveCreditLotsForFifo is ordered by expiredAt ASC
            }
        }

        return LoyaltyOverviewResponse.builder()
                .currentTier(loyalty.getCurrentTier())
                .totalPoints(loyalty.getTotalPoints())
                .availablePoints(loyalty.getAvailablePoints())
                .redeemedPoints(loyalty.getRedeemedPoints())
                .expiredPoints(loyalty.getExpiredPoints())
                .totalSpent(loyalty.getTotalSpent())
                .totalVisits(loyalty.getTotalVisits())
                .nextExpiringPoints(nextExpiryAt != null ? nextExpiringPoints : null)
                .nextExpiryAt(nextExpiryAt)
                .build();
    }

    private void backfillMissingEarnPoints(Long customerId) {
        bookingRepository.findByCustomerIdOrderByStartTimeDesc(customerId).stream()
                .filter(booking -> "COMPLETED".equals(booking.getStatus()))
                .filter(booking -> "PAID".equals(booking.getPaymentStatus()))
                .filter(booking -> pointTransactionRepository
                        .findByBookingIdAndType(booking.getId(), "EARN")
                        .isEmpty())
                .forEach(booking -> {
                    // Backfill both statistics (totalSpent, totalVisits) AND earn points
                    updateBookingStatistics(booking.getId());
                    earnPointsAfterPaidBooking(booking.getId());
                });
    }

    @Override
    public List<LoyaltyTierRuleResponse> getTierRules() {
        return loyaltyTierRuleRepository.findByIsActiveTrueOrderByPriorityLevelAsc().stream()
                .map(rule -> LoyaltyTierRuleResponse.builder()
                        .id(rule.getId()).tier(rule.getTier())
                        .minTotalSpent(rule.getMinTotalSpent()).minTotalVisits(rule.getMinTotalVisits())
                        .minTotalPoints(rule.getMinTotalPoints()).bookingWindowDays(rule.getBookingWindowDays())
                        .maxUpcomingBookings(rule.getMaxUpcomingBookings()).pointMultiplier(rule.getPointMultiplier())
                        .priorityLevel(rule.getPriorityLevel()).isActive(rule.getIsActive()).color(rule.getColor()).build())
                .toList();
    }

    @Override
    public void reviewCustomerTier(Long customerId) {
        CustomerLoyalty loyalty = getOrCreateCustomerLoyalty(customerId);
        String oldTier = loyalty.getCurrentTier();

        List<LoyaltyTierRule> rules = loyaltyTierRuleRepository.findByIsActiveTrueOrderByPriorityLevelDesc();

       final String[] newTierHolder = {"NEW"};
for (LoyaltyTierRule rule : rules) {
    boolean eligible = loyalty.getTotalSpent().compareTo(rule.getMinTotalSpent()) >= 0
            && loyalty.getTotalVisits() >= rule.getMinTotalVisits()
            && loyalty.getTotalPoints() >= rule.getMinTotalPoints();
    if (eligible) {
        newTierHolder[0] = rule.getTier();
        break;
    }
}
String newTier = newTierHolder[0];

        loyalty.setCurrentTier(newTier);
        customerLoyaltyRepository.save(loyalty);

        // Trigger TIER_UPGRADED nếu tier mới cao hơn tier cũ
        if (!newTier.equals(oldTier) && isTierHigher(newTier, oldTier)) {
            notificationService.notifyTierUpgraded(customerId, oldTier, newTier);

            userRepository.findById(customerId).ifPresent(user -> {
                if (user.getEmail() != null && !user.getEmail().isBlank()) {
                    emailService.sendTierUpgradedEmail(user.getEmail(), user.getFullName(), oldTier, newTier);
                }
            });
        }
    }

    private boolean isTierHigher(String newTier, String oldTier) {
        int newPriority = loyaltyTierRuleRepository.findByTier(newTier)
                .map(r -> r.getPriorityLevel() != null ? r.getPriorityLevel() : 0)
                .orElse(0);
        int oldPriority = loyaltyTierRuleRepository.findByTier(oldTier)
                .map(r -> r.getPriorityLevel() != null ? r.getPriorityLevel() : 0)
                .orElse(0);
        return newPriority > oldPriority;
    }

    @Override
    public void updateBookingStatistics(Long bookingId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new RuntimeException("Booking not found"));

        if (!"COMPLETED".equals(booking.getStatus())) {
            return;
        }

        if (!"PAID".equals(booking.getPaymentStatus())) {
            return;
        }

        // Guest booking — skip
        if (booking.getCustomerId() == null) {
            return;
        }

        if (Boolean.TRUE.equals(booking.getRewardProcessed())) {
            return;
        }

        CustomerLoyalty loyalty = getOrCreateCustomerLoyalty(booking.getCustomerId());

        BigDecimal currentSpent = loyalty.getTotalSpent() != null
                ? loyalty.getTotalSpent() : java.math.BigDecimal.ZERO;
        loyalty.setTotalSpent(currentSpent.add(
                booking.getFinalPrice() != null ? booking.getFinalPrice() : java.math.BigDecimal.ZERO));

        int currentVisits = loyalty.getTotalVisits() != null ? loyalty.getTotalVisits() : 0;
        loyalty.setTotalVisits(currentVisits + 1);

        loyalty.setLastVisitAt(LocalDateTime.now());

        customerLoyaltyRepository.save(loyalty);

        booking.setRewardProcessed(true);
        bookingRepository.save(booking);
    }

    @Override
    public List<LoyaltyTierRuleResponse> getAdminTierRules() {
        return loyaltyTierRuleRepository.findAllByOrderByPriorityLevelAsc().stream()
                .map(rule -> LoyaltyTierRuleResponse.builder()
                        .id(rule.getId()).tier(rule.getTier())
                        .minTotalSpent(rule.getMinTotalSpent()).minTotalVisits(rule.getMinTotalVisits())
                        .minTotalPoints(rule.getMinTotalPoints()).bookingWindowDays(rule.getBookingWindowDays())
                        .maxUpcomingBookings(rule.getMaxUpcomingBookings()).pointMultiplier(rule.getPointMultiplier())
                        .priorityLevel(rule.getPriorityLevel()).isActive(rule.getIsActive()).color(rule.getColor()).build())
                .toList();
    }

    private static final String DEFAULT_TIER_COLOR = "#2563EB";
    private static final java.util.regex.Pattern HEX_COLOR_PATTERN =
            java.util.regex.Pattern.compile("^#[0-9A-Fa-f]{6}$");

    private String resolveColor(String color) {
        if (color != null && HEX_COLOR_PATTERN.matcher(color.trim()).matches()) {
            return color.trim().toUpperCase();
        }
        return DEFAULT_TIER_COLOR;
    }

    @Override
    public LoyaltyTierRuleResponse createTierRule(CreateLoyaltyTierRuleRequest request) {
        if (loyaltyTierRuleRepository.findByTier(request.getTier()).isPresent()) {
            throw new RuntimeException("Tier already exists");
        }

        LoyaltyTierRule rule = new LoyaltyTierRule();
        rule.setTier(request.getTier().toUpperCase());
        rule.setMinTotalSpent(request.getMinTotalSpent());
        rule.setMinTotalVisits(request.getMinTotalVisits());
        rule.setMinTotalPoints(request.getMinTotalPoints());
        rule.setBookingWindowDays(request.getBookingWindowDays());
        rule.setMaxUpcomingBookings(request.getMaxUpcomingBookings());
        rule.setPointMultiplier(request.getPointMultiplier());
        rule.setPriorityLevel(request.getPriorityLevel());
        rule.setIsActive(true);
        rule.setColor(resolveColor(request.getColor()));
        loyaltyTierRuleRepository.save(rule);

        return LoyaltyTierRuleResponse.builder()
                .id(rule.getId())
                .tier(rule.getTier())
                .minTotalSpent(rule.getMinTotalSpent())
                .minTotalVisits(rule.getMinTotalVisits())
                .minTotalPoints(rule.getMinTotalPoints())
                .bookingWindowDays(rule.getBookingWindowDays())
                .maxUpcomingBookings(rule.getMaxUpcomingBookings())
                .pointMultiplier(rule.getPointMultiplier())
                .priorityLevel(rule.getPriorityLevel())
                .isActive(rule.getIsActive())
                .color(rule.getColor())
                .build();
    }

    @Override
    public LoyaltyTierRuleResponse updateTierRule(Long id, UpdateLoyaltyTierRuleRequest request) {
        LoyaltyTierRule rule = loyaltyTierRuleRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Tier rule not found"));

        rule.setMinTotalSpent(request.getMinTotalSpent());
        rule.setMinTotalVisits(request.getMinTotalVisits());
        rule.setMinTotalPoints(request.getMinTotalPoints());
        rule.setBookingWindowDays(request.getBookingWindowDays());
        rule.setMaxUpcomingBookings(request.getMaxUpcomingBookings());
        rule.setPointMultiplier(request.getPointMultiplier());
        rule.setPriorityLevel(request.getPriorityLevel());

        if (request.getIsActive() != null) {
            rule.setIsActive(request.getIsActive());
        }

        if (request.getColor() != null) {
            rule.setColor(resolveColor(request.getColor()));
        }

        loyaltyTierRuleRepository.save(rule);

        return LoyaltyTierRuleResponse.builder()
                .id(rule.getId())
                .tier(rule.getTier())
                .minTotalSpent(rule.getMinTotalSpent())
                .minTotalVisits(rule.getMinTotalVisits())
                .minTotalPoints(rule.getMinTotalPoints())
                .bookingWindowDays(rule.getBookingWindowDays())
                .maxUpcomingBookings(rule.getMaxUpcomingBookings())
                .pointMultiplier(rule.getPointMultiplier())
                .priorityLevel(rule.getPriorityLevel())
                .isActive(rule.getIsActive())
                .color(rule.getColor())
                .build();
    }

    // ===================== ISSUE #23 =====================

    @Override
    @Transactional
    public void earnPointsAfterPaidBooking(Long bookingId) {
        // Idempotent check
        if (pointTransactionRepository.findByBookingIdAndType(bookingId, "EARN").isPresent()) {
            return;
        }

        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new RuntimeException("Booking not found: " + bookingId));

        if (!"COMPLETED".equals(booking.getStatus()) || !"PAID".equals(booking.getPaymentStatus())) {
            return;
        }

        if (booking.getCustomerId() == null) {
            return;
        }

        CustomerLoyalty loyalty = getOrCreateCustomerLoyalty(booking.getCustomerId());

        LoyaltyTierRule tierRule = loyaltyTierRuleRepository
                .findByTierAndIsActiveTrue(loyalty.getCurrentTier())
                .orElse(null);

        double multiplier = tierRule != null ? tierRule.getPointMultiplier().doubleValue() : 1.0;

        com.autowashpro.entity.ServicePackage pkg = servicePackageRepository
                .findById(booking.getServicePackageId())
                .orElseThrow(() -> new RuntimeException("Service package not found"));

        BigDecimal originalPrice = booking.getOriginalPrice() != null && booking.getOriginalPrice().compareTo(BigDecimal.ZERO) > 0
                ? booking.getOriginalPrice()
                : booking.getFinalPrice();
        BigDecimal finalPrice = booking.getFinalPrice() != null
                ? booking.getFinalPrice()
                : originalPrice;

        if (originalPrice == null || originalPrice.compareTo(BigDecimal.ZERO) <= 0 || finalPrice == null) {
            return;
        }

        Integer basePoints = pkg.getPointsEarned();
        if (basePoints == null || basePoints <= 0) {
            // fallback dùng originalPrice để tránh double-discount (finalPrice đã trừ loyalty rồi)
            basePoints = originalPrice
                    .divide(BigDecimal.valueOf(10000), 0, RoundingMode.DOWN)
                    .intValue();
        }

        double ratio = finalPrice.doubleValue() / originalPrice.doubleValue();
        int earnedPoints = (int) Math.floor(basePoints * multiplier * ratio);

        if (earnedPoints <= 0) {
            return;
        }

        loyalty.setTotalPoints(loyalty.getTotalPoints() + earnedPoints);
        loyalty.setAvailablePoints(loyalty.getAvailablePoints() + earnedPoints);
        customerLoyaltyRepository.save(loyalty);

        PointTransaction pt = new PointTransaction();
        pt.setCustomerId(booking.getCustomerId());
        pt.setBookingId(bookingId);
        pt.setType("EARN");
        pt.setPoints(earnedPoints);
        pt.setRemainingPoints(earnedPoints);
        pt.setExpiredAt(LocalDateTime.now().plusMonths(expiryMonths));
        pt.setSource("BOOKING_EARN");
        pt.setNote("Earned " + earnedPoints + " points from booking #" + bookingId);
        pointTransactionRepository.save(pt);

        // Review tier — sẽ trigger TIER_UPGRADED nếu đủ điều kiện
        reviewCustomerTier(booking.getCustomerId());
    }

    @Override
    @Transactional
    public void refundPointsForCanceledBooking(Long bookingId) {
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new RuntimeException("Booking not found: " + bookingId));

        if (booking.getCustomerId() == null || booking.getUsedPoints() == null || booking.getUsedPoints() <= 0) {
            return;
        }

        if ("NO_SHOW".equals(booking.getStatus())) {
            return;
        }

        loyaltyPointExpiryService.refundByAllocation(bookingId);
    }

    @Override
    @Transactional
    public void adjustPoints(Long customerId, Integer points, String type, String reason) {
        if (points > 0) {
            loyaltyPointExpiryService.expireForCustomer(customerId);
            CustomerLoyalty loyalty = getOrCreateCustomerLoyalty(customerId);
            loyalty.setTotalPoints(loyalty.getTotalPoints() + points);
            loyalty.setAvailablePoints(loyalty.getAvailablePoints() + points);
            customerLoyaltyRepository.save(loyalty);

            PointTransaction pt = new PointTransaction();
            pt.setCustomerId(customerId);
            pt.setType(type);
            pt.setPoints(points);
            pt.setRemainingPoints(points);
            pt.setExpiredAt(LocalDateTime.now().plusMonths(expiryMonths));
            pt.setSource("ADMIN_ADJUST");
            pt.setNote(reason);
            pointTransactionRepository.save(pt);
        } else if (points < 0) {
            int deduct = Math.abs(points);
            loyaltyPointExpiryService.consumePointsFifoWithType(
                    customerId, deduct, null,
                    type, "ADMIN_ADJUST", reason);
        }

        reviewCustomerTier(customerId);
        notificationService.notifyPointsAdjusted(customerId, points, reason);
    }

    @Override
    public Page<PointTransactionResponse> getMyTransactions(Long customerId, int page, int limit, String type) {
        PageRequest pageable = PageRequest.of(page - 1, limit);

        Page<PointTransaction> transactions;

        if (type != null && !type.isBlank()) {
            transactions = pointTransactionRepository
                    .findByCustomerIdAndTypeOrderByCreatedAtDesc(customerId, type, pageable);
        } else {
            transactions = pointTransactionRepository
                    .findByCustomerIdOrderByCreatedAtDesc(customerId, pageable);
        }

        return transactions.map(t -> PointTransactionResponse.builder()
                .id(t.getId())
                .customerId(t.getCustomerId())
                .bookingId(t.getBookingId())
                .type(t.getType())
                .points(t.getPoints())
                .remainingPoints(t.getRemainingPoints())
                .expiredAt(t.getExpiredAt())
                .source(t.getSource())
                .note(t.getNote())
                .createdAt(t.getCreatedAt())
                .build());
    }

    @Override
    @Transactional(readOnly = true)
    public LeaderboardResponse getLeaderboard(String period, int page, int limit, Long currentCustomerId) {
        if (page < 1) page = 1;
        if (limit < 1) limit = 10;
        final int MAX_RANK = 100;

        if (!"MONTHLY".equals(period) && !"ALL_TIME".equals(period)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid period: must be MONTHLY or ALL_TIME");
        }

        // 1. Determine time range
        ZoneId zone = ZoneId.of("Asia/Bangkok");
        LocalDate periodStart = null;
        LocalDate periodEnd = null;
        LocalDateTime rangeStart = null;
        LocalDateTime rangeEnd = null;

        if ("MONTHLY".equals(period)) {
            YearMonth current = YearMonth.now(zone);
            periodStart = current.atDay(1);
            periodEnd = current.atEndOfMonth();
            rangeStart = periodStart.atStartOfDay();
            rangeEnd = periodEnd.plusDays(1).atStartOfDay();
        }

        // 2. Aggregate: [customerId, totalScore, washCount]
        List<Object[]> aggregateRows = "MONTHLY".equals(period)
                ? pointTransactionRepository.findLeaderboardAggregateMonthly(rangeStart, rangeEnd)
                : pointTransactionRepository.findLeaderboardAggregateAllTime();

        // 3. Assign sequential rank — store as long[4]: [customerId, score, rank, washCount]
        List<long[]> ranked = new ArrayList<>(aggregateRows.size());
        int rankCounter = 1;
        for (Object[] row : aggregateRows) {
            long cid = ((Number) row[0]).longValue();
            long score = ((Number) row[1]).longValue();
            long washCount = row[2] != null ? ((Number) row[2]).longValue() : 0L;
            ranked.add(new long[]{cid, score, rankCounter++, washCount});
        }

        // 4. Cap public leaderboard at MAX_RANK
        List<long[]> capped = ranked.size() > MAX_RANK ? ranked.subList(0, MAX_RANK) : ranked;
        // entries shows rank 4+ only (topThree podium occupies ranks 1–3)
        // The podium highlights ranks 1-3, while Top Rankings remains the
        // complete, continuous rank 1-100 list.
        long totalItems = capped.size();
        int totalPages = totalItems == 0 ? 0 : (int) Math.ceil((double) totalItems / limit);

        // 5. Batch-load users (capped + current user for "Your Rank" card)
        List<Long> cappedIds = capped.stream().map(r -> r[0]).collect(Collectors.toList());
        List<Long> allIds = new ArrayList<>(cappedIds);
        if (currentCustomerId != null && !allIds.contains(currentCustomerId)) {
            allIds.add(currentCustomerId);
        }
        Map<Long, User> userMap = userRepository.findAllById(allIds).stream()
                .collect(Collectors.toMap(User::getId, u -> u));

        // 6. Batch-load avatars (capped + current user)
        List<Long> avatarIds = new ArrayList<>(cappedIds);
        if (currentCustomerId != null && !avatarIds.contains(currentCustomerId)) {
            avatarIds.add(currentCustomerId);
        }
        Map<Long, String> avatarMap = new java.util.HashMap<>();
        if (!avatarIds.isEmpty()) {
            List<Upload> uploads = uploadRepository.findAvatarsByOwnerIds(avatarIds);
            avatarMap = uploads.stream()
                    .collect(Collectors.toMap(Upload::getOwnerId, Upload::getFileUrl, (a, b) -> a));
        }

        // 7. Build full capped list
        final Map<Long, String> finalAvatarMap = avatarMap;
        List<LeaderboardEntryResponse> all = capped.stream().map(r -> {
            long cid = r[0];
            int score = (int) r[1];
            int rank = (int) r[2];
            int washes = (int) r[3];
            User user = userMap.get(cid);
            String fn = user != null ? user.getFullName() : null;
            return LeaderboardEntryResponse.builder()
                    .userId(cid)
                    .displayName(buildDisplayName(fn))
                    .initials(buildInitials(fn))
                    .avatarUrl(finalAvatarMap.get(cid))
                    .score(score)
                    .rank(rank)
                    .completedWashes(washes)
                    .currentUser(currentCustomerId != null && cid == currentCustomerId)
                    .build();
        }).collect(Collectors.toList());

        // 8. Top 3 for podium
        List<LeaderboardEntryResponse> topThree = all.stream()
                .filter(e -> e.getRank() <= 3)
                .collect(Collectors.toList());

        // 9. Paginate the complete rank 1-100 list; Top 3 also remain in the podium.
        int fromIndex = (page - 1) * limit;
        int toIndex = Math.min(fromIndex + limit, all.size());
        List<LeaderboardEntryResponse> pageEntries = fromIndex >= all.size()
                ? Collections.emptyList()
                : all.subList(fromIndex, toIndex);

        // 10. Current user card (may be outside top 100)
        final Long finalCurrentCustomerId = currentCustomerId;
        LeaderboardEntryResponse currentUserEntry = all.stream()
                .filter(e -> e.getUserId().equals(finalCurrentCustomerId))
                .findFirst()
                .orElseGet(() -> {
                    // Ranked but outside top 100
                    long[] outerRow = ranked.stream()
                            .filter(r -> r[0] == finalCurrentCustomerId)
                            .findFirst().orElse(null);
                    User cu = userMap.get(finalCurrentCustomerId);
                    String fn = cu != null ? cu.getFullName() : null;
                    if (outerRow != null) {
                        return LeaderboardEntryResponse.builder()
                                .userId(finalCurrentCustomerId)
                                .displayName(buildDisplayName(fn))
                                .initials(buildInitials(fn))
                                .avatarUrl(finalAvatarMap.get(finalCurrentCustomerId))
                                .score((int) outerRow[1])
                                .rank((int) outerRow[2])
                                .completedWashes((int) outerRow[3])
                                .currentUser(true)
                                .build();
                    }
                    // Unranked
                    return LeaderboardEntryResponse.builder()
                            .userId(finalCurrentCustomerId)
                            .displayName(buildDisplayName(fn))
                            .initials(buildInitials(fn))
                            .avatarUrl(finalAvatarMap.get(finalCurrentCustomerId))
                            .score(0).rank(null).completedWashes(0).currentUser(true)
                            .build();
                });

        return LeaderboardResponse.builder()
                .period(period)
                .periodStart(periodStart)
                .periodEnd(periodEnd)
                .topThree(topThree)
                .entries(pageEntries)
                .currentUser(currentUserEntry)
                .page(page)
                .limit(limit)
                .totalItems(totalItems)
                .totalPages(totalPages)
                .build();
    }

    private String buildDisplayName(String fullName) {
        return DisplayNameHelper.buildDisplayName(fullName);
    }

    private String buildInitials(String fullName) {
        return DisplayNameHelper.buildInitials(fullName);
    }

    @Override
    public RedeemPreviewResponse redeemPreview(Long customerId, RedeemPreviewRequest request) {
        loyaltyPointExpiryService.expireForCustomer(customerId);
        CustomerLoyalty loyalty = getOrCreateCustomerLoyalty(customerId);

        com.autowashpro.entity.ServicePackage pkg = servicePackageRepository
                .findById(request.getServicePackageId())
                .orElseThrow(() -> new RuntimeException("Service package not found"));

        int availablePoints = loyalty.getAvailablePoints();
        int requestedPoints = request.getPoints();

        if (requestedPoints > availablePoints) {
            throw new RuntimeException("Bạn không đủ điểm khả dụng để đổi.");
        }

        BigDecimal originalPrice = pkg.getBasePrice();
        BigDecimal eligibleAmount = request.getSubtotalAfterPromotion() != null
                ? request.getSubtotalAfterPromotion()
                : originalPrice;

        // max 50% of eligible amount AND final must remain >= 50,000đ
        BigDecimal maxByPercent = eligibleAmount.multiply(BigDecimal.valueOf(0.5));
        BigDecimal maxByMinPayable = eligibleAmount.subtract(BigDecimal.valueOf(50000));
        BigDecimal maxDiscount = maxByPercent.min(maxByMinPayable);
        if (maxDiscount.compareTo(BigDecimal.ZERO) < 0) maxDiscount = BigDecimal.ZERO;

        int maxPoints = maxDiscount.divide(BigDecimal.valueOf(1000), RoundingMode.DOWN).intValue();
        maxPoints = (maxPoints / 10) * 10;

        int validPoints = (requestedPoints / 10) * 10;
        validPoints = Math.max(0, validPoints);

        String message = null;
        if (validPoints > maxPoints) {
            validPoints = maxPoints;
            if (validPoints == 0) {
                message = String.format(
                    "Không thể áp dụng điểm loyalty. Giá trị đơn sau khuyến mãi (%.0fđ) quá thấp hoặc không đủ để áp dụng tối thiểu 10 điểm.",
                    eligibleAmount.doubleValue()
                );
            } else {
                message = String.format(
                    "Chỉ áp dụng tối đa %d điểm (giảm tối đa 50%% và giữ tổng thanh toán ≥ 50.000đ).",
                    validPoints
                );
            }
        }

        BigDecimal discountAmount = BigDecimal.valueOf(validPoints * 1000L);
        BigDecimal estimatedFinalPrice = eligibleAmount.subtract(discountAmount);

        return RedeemPreviewResponse.builder()
                .requestedPoints(requestedPoints)
                .validPoints(validPoints)
                .discountAmount(discountAmount)
                .originalPrice(originalPrice)
                .estimatedFinalPrice(estimatedFinalPrice)
                .message(message)
                .build();
    }
}
