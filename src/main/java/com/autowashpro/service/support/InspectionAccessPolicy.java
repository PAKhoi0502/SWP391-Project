package com.autowashpro.service.support;

import com.autowashpro.entity.Booking;
import com.autowashpro.entity.StaffProfile;
import com.autowashpro.repository.StaffProfileRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

@Component
@RequiredArgsConstructor
public class InspectionAccessPolicy {

    private final StaffProfileRepository staffProfileRepository;

    public void requireCanManage(Booking booking, Long currentUserId, String role) {
        if ("ROLE_ADMIN".equals(normalizeRole(role))) {
            return;
        }

        if (!"ROLE_STAFF".equals(normalizeRole(role))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only staff or admin can manage inspection images");
        }

        StaffProfile staffProfile = staffProfileRepository.findByUser_Id(currentUserId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.FORBIDDEN,
                        "No staff profile found for current user"));

        if (!Boolean.TRUE.equals(staffProfile.getIsActive())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Staff profile is inactive");
        }

        if (!staffProfile.getGarageId().equals(booking.getGarageId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Staff cannot manage images from another garage");
        }
    }

    private String normalizeRole(String role) {
        if (role == null) {
            return "";
        }
        String normalized = role.trim().toUpperCase();
        return normalized.startsWith("ROLE_") ? normalized : "ROLE_" + normalized;
    }
}
