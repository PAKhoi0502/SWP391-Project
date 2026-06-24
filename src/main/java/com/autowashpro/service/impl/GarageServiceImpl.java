package com.autowashpro.service.impl;

import com.autowashpro.dto.request.GarageCreateRequest;
import com.autowashpro.dto.request.GarageStatusUpdateRequest;
import com.autowashpro.dto.request.GarageUpdateRequest;
import com.autowashpro.dto.response.GarageCapabilitiesResponse;
import com.autowashpro.dto.response.GarageResponse;
import com.autowashpro.dto.response.PageResponse;
import com.autowashpro.entity.Garage;
import com.autowashpro.repository.GarageRepository;
import com.autowashpro.repository.WashBayRepository;
import com.autowashpro.repository.spec.GarageSpecifications;
import com.autowashpro.service.GarageService;
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
public class GarageServiceImpl implements GarageService {

    private final GarageRepository garageRepository;
    private final WashBayRepository washBayRepository;

    @Override
    @Transactional
    public GarageResponse create(GarageCreateRequest request) {
        if (garageRepository.existsByGarageCode(request.getGarageCode())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "garage_code already exists: " + request.getGarageCode());
        }
        if (garageRepository.existsByPhone(request.getPhone())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Phone already exists: " + request.getPhone());
        }

        Garage garage = new Garage();
        garage.setName(request.getName());
        garage.setGarageCode(request.getGarageCode());
        garage.setAddress(request.getAddress());
        garage.setCity(request.getCity());
        garage.setPhone(request.getPhone());
        garage.setOpeningTime(request.getOpeningTime());
        garage.setClosingTime(request.getClosingTime());
        garage.setSlotIntervalMinutes(request.getSlotIntervalMinutes());
        garage.setIsActive(true);

        return toResponse(garageRepository.save(garage));
    }

    @Override
    public GarageResponse getById(Long id) {
        return toResponse(findOrThrow(id));
    }

    @Override
    @Transactional
    public GarageResponse update(Long id, GarageUpdateRequest request) {
        Garage garage = findOrThrow(id);

        if (request.getName() != null) garage.setName(request.getName());
        if (request.getAddress() != null) garage.setAddress(request.getAddress());
        if (request.getCity() != null) garage.setCity(request.getCity());
        if (request.getPhone() != null) garage.setPhone(request.getPhone());
        if (request.getOpeningTime() != null) garage.setOpeningTime(request.getOpeningTime());
        if (request.getClosingTime() != null) garage.setClosingTime(request.getClosingTime());
        if (request.getSlotIntervalMinutes() != null)
            garage.setSlotIntervalMinutes(request.getSlotIntervalMinutes());

        return toResponse(garageRepository.save(garage));
    }

    @Override
    @Transactional
    public GarageResponse updateStatus(Long id, GarageStatusUpdateRequest request) {
        Garage garage = findOrThrow(id);
        garage.setIsActive(request.getIsActive());
        return toResponse(garageRepository.save(garage));
    }

    @Override
    public PageResponse<GarageResponse> list(int page, int limit, Boolean isActive, String keyword) {
        Specification<Garage> spec = Specification
                .where(GarageSpecifications.isActiveEquals(isActive))
                .and(GarageSpecifications.keywordContains(keyword));

        Page<Garage> result = garageRepository.findAll(spec, PageRequest.of(Math.max(page - 1, 0), limit));

        return PageResponse.<GarageResponse>builder()
                .data(result.getContent().stream().map(this::toResponse).collect(Collectors.toList()))
                .page(page)
                .limit(limit)
                .totalItems(result.getTotalElements())
                .totalPages(result.getTotalPages())
                .build();
    }

    @Override
    public GarageCapabilitiesResponse getCapabilities(Long id) {
        findOrThrow(id); // xác nhận garage tồn tại
        return GarageCapabilitiesResponse.builder()
                .garageId(id)
                .supportedVehicleTypes(washBayRepository.findDistinctVehicleTypesByGarageId(id))
                .build();
    }

    @Override
    public void assertGarageIsActive(Long garageId) {
        Garage garage = findOrThrow(garageId);
        if (!Boolean.TRUE.equals(garage.getIsActive())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Garage is inactive: " + garageId);
        }
    }

    private Garage findOrThrow(Long id) {
        return garageRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Garage not found: " + id));
    }

    private GarageResponse toResponse(Garage g) {
        return GarageResponse.builder()
                .id(g.getId())
                .name(g.getName())
                .garageCode(g.getGarageCode())
                .address(g.getAddress())
                .city(g.getCity())
                .phone(g.getPhone())
                .openingTime(g.getOpeningTime())
                .closingTime(g.getClosingTime())
                .slotIntervalMinutes(g.getSlotIntervalMinutes())
                .isActive(g.getIsActive())
                .createdAt(g.getCreatedAt())
                .updatedAt(g.getUpdatedAt())
                .build();
    }
}