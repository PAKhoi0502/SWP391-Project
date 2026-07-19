package com.autowashpro.scheduler;

import com.autowashpro.dto.response.CustomerExpiryResultResponse;
import com.autowashpro.dto.response.ExpiryRunResult;
import com.autowashpro.entity.ExpiryRunLog;
import com.autowashpro.repository.ExpiryRunLogRepository;
import com.autowashpro.repository.PointTransactionRepository;
import com.autowashpro.service.LoyaltyPointExpiryService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.PageRequest;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Slf4j
@Component
@RequiredArgsConstructor
public class LoyaltyPointExpiryScheduler {

    private final LoyaltyPointExpiryService loyaltyPointExpiryService;
    private final PointTransactionRepository pointTransactionRepository;
    private final ExpiryRunLogRepository expiryRunLogRepository;
    private final Clock clock;

    @Value("${loyalty.points.expiry-batch-size:100}")
    private int batchSize;

    @Scheduled(
        cron = "${loyalty.points.expiry-cron:0 15 2 * * *}",
        zone = "${loyalty.points.expiry-zone:Asia/Ho_Chi_Minh}"
    )
    public void runDailyExpiry() {
        LocalDateTime now = LocalDateTime.now(clock);
        log.info("[EXPIRY_SCHEDULER] Starting daily point expiry at {}", now);

        ExpiryRunLog runLog = new ExpiryRunLog();
        runLog.setTriggerType("SCHEDULED");
        runLog.setStatus("RUNNING");
        runLog.setStartedAt(now);
        runLog = expiryRunLogRepository.save(runLog);

        int succeeded = 0, failed = 0;
        int totalLots = 0, totalPoints = 0;
        List<Long> failedCustomers = new ArrayList<>();
        long afterId = 0L;

        try {
            while (true) {
                List<Long> batch = pointTransactionRepository
                        .findCustomerIdsWithExpiredLotsAfter(now, afterId,
                                PageRequest.of(0, batchSize));

                if (batch.isEmpty()) break;

                for (Long customerId : batch) {
                    try {
                        CustomerExpiryResultResponse result =
                                loyaltyPointExpiryService.expireForCustomer(customerId);
                        totalLots   += result.getLotsExpired();
                        totalPoints += result.getPointsExpired();
                        succeeded++;
                    } catch (Exception e) {
                        failed++;
                        failedCustomers.add(customerId);
                        log.error("[EXPIRY_SCHEDULER] Error expiring points for customer {}: {}",
                                customerId, e.getMessage(), e);
                    }
                }

                afterId = batch.get(batch.size() - 1);
                if (batch.size() < batchSize) break;
            }

            String status = (succeeded + failed) == 0     ? "SUCCESS"
                          : failed == 0                    ? "SUCCESS"
                          : succeeded == 0                 ? "FAILURE"
                                                          : "PARTIAL_FAILURE";
            String errorSummary = failed > 0
                    ? "Failed customers: " + failedCustomers.toString()
                    : null;

            runLog.setStatus(status);
            runLog.setFinishedAt(LocalDateTime.now(clock));
            runLog.setCustomersProcessed(succeeded + failed);
            runLog.setCustomersSucceeded(succeeded);
            runLog.setCustomersFailed(failed);
            runLog.setLotsExpired(totalLots);
            runLog.setPointsExpired(totalPoints);
            runLog.setErrorSummary(errorSummary);
            expiryRunLogRepository.save(runLog);

            log.info("[EXPIRY_SCHEDULER] Done. succeeded={}, failed={}, lots={}, points={}",
                    succeeded, failed, totalLots, totalPoints);

        } catch (Exception e) {
            runLog.setStatus("FAILURE");
            runLog.setFinishedAt(LocalDateTime.now(clock));
            runLog.setCustomersProcessed(succeeded);
            runLog.setCustomersSucceeded(succeeded);
            runLog.setCustomersFailed(failed);
            runLog.setLotsExpired(totalLots);
            runLog.setPointsExpired(totalPoints);
            runLog.setErrorSummary(e.getMessage());
            expiryRunLogRepository.save(runLog);
            log.error("[EXPIRY_SCHEDULER] Scheduler failed: {}", e.getMessage(), e);
        }
    }

    /** Build an ExpiryRunResult DTO from a persisted ExpiryRunLog row. */
    public static ExpiryRunResult toDto(ExpiryRunLog log) {
        if (log == null) return null;
        return ExpiryRunResult.builder()
                .logId(log.getId())
                .triggerType(log.getTriggerType())
                .startedAt(log.getStartedAt())
                .finishedAt(log.getFinishedAt())
                .status(log.getStatus())
                .customersProcessed(log.getCustomersProcessed())
                .customersSucceeded(log.getCustomersSucceeded())
                .customersFailed(log.getCustomersFailed())
                .lotsExpired(log.getLotsExpired())
                .pointsExpired(log.getPointsExpired())
                .failedCustomers(List.of())
                .errorSummary(log.getErrorSummary())
                .build();
    }
}
