package com.autowashpro.service.support;

import com.autowashpro.entity.StaffProfile;
import com.autowashpro.entity.enums.StaffType;
import com.autowashpro.repository.StaffProfileRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.util.Objects;

/**
 * Centralised authorization policy for operations that require CUSTOMER_SERVICE_STAFF or ADMIN.
 * Replaces scattered inline checks across service implementations.
 */
@Component
@RequiredArgsConstructor
public class StaffOperationAccessPolicy {

    private final StaffProfileRepository staffProfileRepository;

    /**
     * Loads profile, verifies it is active and CUSTOMER_SERVICE_STAFF.
     * Throws 403 on any failure. Returns the validated profile.
     */
    public StaffProfile requireCustomerServiceStaff(Long userId) {
        StaffProfile profile = staffProfileRepository.findByUser_Id(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "Staff profile not found"));
        if (!Boolean.TRUE.equals(profile.getIsActive())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Staff profile is inactive");
        }
        if (profile.getStaffType() != StaffType.CUSTOMER_SERVICE_STAFF) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Only CUSTOMER_SERVICE_STAFF can perform this action");
        }
        return profile;
    }

    /**
     * CSS + garage scope check. Throws 403 if the profile is not CSS, inactive, or from another garage.
     */
    public StaffProfile requireCustomerServiceStaffForGarage(Long userId, Long garageId) {
        StaffProfile profile = requireCustomerServiceStaff(userId);
        if (profile.getGarageId() == null || garageId == null || !Objects.equals(profile.getGarageId(), garageId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Staff cannot perform this action for another garage");
        }
        return profile;
    }

    /**
     * Admin bypass + CSS check. Returns null for ROLE_ADMIN (no profile needed), CSS profile otherwise.
     * Throws 403 for any other role or non-CSS staff.
     */
    public StaffProfile requireCustomerServiceOrAdmin(Long userId, String role) {
        if ("ROLE_ADMIN".equals(role)) {
            return null;
        }
        if (!"ROLE_STAFF".equals(role)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
        }
        return requireCustomerServiceStaff(userId);
    }

    /**
     * Admin bypass + CSS + garage check. Returns null for ROLE_ADMIN (admin is not garage-scoped).
     * Throws 403 for non-CSS, inactive, wrong garage, or unknown role.
     */
    public StaffProfile requireCustomerServiceOrAdminForGarage(Long userId, String role, Long garageId) {
        StaffProfile profile = requireCustomerServiceOrAdmin(userId, role);
        if (profile != null && (profile.getGarageId() == null || garageId == null || !Objects.equals(profile.getGarageId(), garageId))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Staff cannot perform this action for another garage");
        }
        return profile;
    }
}
