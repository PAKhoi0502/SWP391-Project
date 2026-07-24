package com.autowashpro.service.support;

import com.autowashpro.entity.Booking;
import com.autowashpro.entity.StaffProfile;
import com.autowashpro.entity.enums.StaffType;
import com.autowashpro.repository.StaffProfileRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

@Component
@RequiredArgsConstructor
public class InspectionAccessPolicy {

    private final StaffProfileRepository staffProfileRepository;

    /**
     * Authorization for READ operations (listByBooking, getById).
     * ADMIN → allowed unconditionally.
     * CUSTOMER → allowed only for their own booking.
     * ROLE_STAFF with CUSTOMER_SERVICE_STAFF type, active, same garage → allowed.
     * All other staff types (VEHICLE_CARE_STAFF, SERVICE_ADVISOR, MANAGER), inactive staff,
     * wrong garage, and unknown roles → 403.
     */
    public void requireCanRead(Booking booking, Long currentUserId, String role) {
        String normalizedRole = normalizeRole(role);

        if ("ROLE_ADMIN".equals(normalizedRole)) {
            return;
        }

        if ("ROLE_CUSTOMER".equals(normalizedRole)) {
            if (!currentUserId.equals(booking.getCustomerId())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "You can only view inspections of your own bookings");
            }
            return;
        }

        if (!"ROLE_STAFF".equals(normalizedRole)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied");
        }

        StaffProfile staffProfile = staffProfileRepository.findByUser_Id(currentUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "No staff profile found for current user"));

        if (!Boolean.TRUE.equals(staffProfile.getIsActive())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Staff profile is inactive");
        }

        if (staffProfile.getStaffType() != StaffType.CUSTOMER_SERVICE_STAFF) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Only CUSTOMER_SERVICE_STAFF can view inspections");
        }

        if (!staffProfile.getGarageId().equals(booking.getGarageId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Staff cannot view inspections from another garage");
        }
    }

    public void requireCanManage(Booking booking, Long currentUserId, String role) {
        if ("ROLE_ADMIN".equals(normalizeRole(role))) {
            return;
        }

        if (!"ROLE_STAFF".equals(normalizeRole(role))) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Only staff or admin can manage inspections");
        }

        StaffProfile staffProfile = staffProfileRepository.findByUser_Id(currentUserId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.FORBIDDEN,
                        "No staff profile found for current user"));

        if (!Boolean.TRUE.equals(staffProfile.getIsActive())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Staff profile is inactive");
        }

        // Only CUSTOMER_SERVICE_STAFF may create/update/delete inspections.
        // VEHICLE_CARE_STAFF and other staff types are explicitly denied.
        if (staffProfile.getStaffType() != StaffType.CUSTOMER_SERVICE_STAFF) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Only CUSTOMER_SERVICE_STAFF can manage inspections");
        }

        if (!staffProfile.getGarageId().equals(booking.getGarageId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Staff cannot manage inspections from another garage");
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
