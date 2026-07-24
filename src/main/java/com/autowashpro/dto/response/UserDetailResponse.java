package com.autowashpro.dto.response;

import lombok.*;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserDetailResponse {

    private Long id;

    private String fullName;

    private String email;

    private String phone;

    private String role;

    private Boolean isActive;

    private Boolean hasPassword;

    private String avatarUrl;

    private String avatarPublicId;
}
