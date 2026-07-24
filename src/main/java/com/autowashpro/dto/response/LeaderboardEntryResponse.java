package com.autowashpro.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class LeaderboardEntryResponse {
    private Long userId;
    private String displayName;
    private String initials;
    private String avatarUrl;
    private Integer score;
    private Integer rank;
    private Integer completedWashes;
    private Boolean currentUser;
}
