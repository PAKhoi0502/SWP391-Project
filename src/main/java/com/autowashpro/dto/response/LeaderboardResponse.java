package com.autowashpro.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDate;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LeaderboardResponse {
    private String period;
    private LocalDate periodStart;
    private LocalDate periodEnd;
    private List<LeaderboardEntryResponse> topThree;
    private List<LeaderboardEntryResponse> entries;
    private LeaderboardEntryResponse currentUser;
    private int page;
    private int limit;
    private long totalItems;
    private int totalPages;
}
