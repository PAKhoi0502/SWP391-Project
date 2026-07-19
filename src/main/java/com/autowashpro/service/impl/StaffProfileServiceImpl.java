package com.autowashpro.service.impl;

import com.autowashpro.dto.request.StaffProfileCreateRequest;
import com.autowashpro.dto.request.StaffProfileStatusUpdateRequest;
import com.autowashpro.dto.request.StaffProfileUpdateRequest;
import com.autowashpro.dto.response.PageResponse;
import com.autowashpro.dto.response.StaffProfileResponse;
import com.autowashpro.entity.StaffProfile;
import com.autowashpro.entity.User;
import com.autowashpro.entity.enums.StaffType;
import com.autowashpro.repository.GarageRepository;
import com.autowashpro.repository.StaffProfileRepository;
import com.autowashpro.repository.UserRepository;
import com.autowashpro.repository.spec.StaffProfileSpecifications;
import com.autowashpro.service.StaffProfileService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class StaffProfileServiceImpl implements StaffProfileService {

    private final StaffProfileRepository staffProfileRepository;
    private final UserRepository userRepository;
    private final GarageRepository garageRepository;

    @Override
    @Transactional
    public StaffProfileResponse create(StaffProfileCreateRequest request) {
        User user = userRepository.findById(request.getUserId())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found: " + request.getUserId()));

        if (!"STAFF".equalsIgnoreCase(user.getRole())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "User must have STAFF role to own a staff profile");
        }

        if (staffProfileRepository.existsByUser_Id(user.getId())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "This user already has a staff profile");
        }

        if (!garageRepository.existsById(request.getGarageId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid garage_id: " + request.getGarageId());
        }

        if (staffProfileRepository.existsByStaffCode(request.getStaffCode())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "staff_code already exists: " + request.getStaffCode());
        }

        StaffProfile profile = new StaffProfile();
        profile.setUser(user);
        profile.setGarageId(request.getGarageId());
        profile.setStaffCode(request.getStaffCode());
        profile.setStaffType(request.getStaffType());
        profile.setIsActive(true);

        return toResponse(staffProfileRepository.save(profile));
    }

    @Override
    public StaffProfileResponse getById(Long id) {
        return toResponse(findOrThrow(id));
    }

    @Override
    public StaffProfileResponse getByUserId(Long userId) {
        StaffProfile profile = staffProfileRepository.findByUser_Id(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Staff profile not found for current user"));
        return toResponse(profile);
    }

    @Override
    @Transactional
    public StaffProfileResponse update(Long id, StaffProfileUpdateRequest request) {
        StaffProfile profile = findOrThrow(id);

        if (request.getGarageId() != null) {
            if (!garageRepository.existsById(request.getGarageId())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Invalid garage_id: " + request.getGarageId());
            }
            profile.setGarageId(request.getGarageId());
        }

        if (request.getStaffType() != null) {
            profile.setStaffType(request.getStaffType());
        }

        return toResponse(staffProfileRepository.save(profile));
    }

    @Override
    @Transactional
    public StaffProfileResponse updateStatus(Long id, StaffProfileStatusUpdateRequest request) {
        StaffProfile profile = findOrThrow(id);
        profile.setIsActive(request.getIsActive());
        return toResponse(staffProfileRepository.save(profile));
    }

    @Override
    public PageResponse<StaffProfileResponse> list(int page, int limit, Long garageId, StaffType staffType, Boolean isActive) {
        Specification<StaffProfile> spec = ((Specification<StaffProfile>) (root, query, cb) -> null)
                .and(StaffProfileSpecifications.garageIdEquals(garageId))
                .and(StaffProfileSpecifications.staffTypeEquals(staffType))
                .and(StaffProfileSpecifications.isActiveEquals(isActive));

        Page<StaffProfile> result = staffProfileRepository.findAll(spec, PageRequest.of(Math.max(page - 1, 0), limit));

        return PageResponse.<StaffProfileResponse>builder()
                .data(result.getContent().stream().map(this::toResponse).collect(Collectors.toList()))
                .page(page)
                .limit(limit)
                .totalItems(result.getTotalElements())
                .totalPages(result.getTotalPages())
                .build();
    }

    @Override
    public void assertStaffCanOperateInGarage(Long userId, Long garageId) {
        StaffProfile profile = staffProfileRepository.findByUser_Id(userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN, "No staff profile found for this user"));

        if (!Boolean.TRUE.equals(profile.getIsActive())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Staff profile is inactive");
        }

        if (!profile.getGarageId().equals(garageId)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Staff cannot operate on a booking from another garage");
        }
    }

    private StaffProfile findOrThrow(Long id) {
        return staffProfileRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Staff profile not found: " + id));
    }

    private StaffProfileResponse toResponse(StaffProfile p) {
        return StaffProfileResponse.builder()
                .id(p.getId())
                .userId(p.getUser().getId())
                .userFullName(p.getUser().getFullName())
                .garageId(p.getGarageId())
                .staffCode(p.getStaffCode())
                .staffType(p.getStaffType())
                .isActive(p.getIsActive())
                .createdAt(p.getCreatedAt())
                .updatedAt(p.getUpdatedAt())
                .build();
    }
}