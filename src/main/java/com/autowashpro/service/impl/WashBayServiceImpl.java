package com.autowashpro.service.impl;

import com.autowashpro.dto.request.WashBayCreateRequest;
import com.autowashpro.dto.request.WashBayStatusUpdateRequest;
import com.autowashpro.dto.request.WashBayUpdateRequest;
import com.autowashpro.dto.response.PageResponse;
import com.autowashpro.dto.response.WashBayCapacityResponse;
import com.autowashpro.dto.response.WashBayResponse;
import com.autowashpro.entity.WashBay;
import com.autowashpro.entity.enums.WashBayStatus;
import com.autowashpro.repository.GarageRepository;
import com.autowashpro.repository.WashBayRepository;
import com.autowashpro.repository.spec.WashBaySpecifications;
import com.autowashpro.service.WashBayService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class WashBayServiceImpl implements WashBayService {

    private final WashBayRepository washBayRepository;
    private final GarageRepository garageRepository;

    @Override
    @Transactional
    public WashBayResponse create(WashBayCreateRequest request) {
        if (!garageRepository.existsById(request.getGarageId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Invalid garage_id: " + request.getGarageId());
        }

        if (washBayRepository.existsByGarageIdAndBayCode(request.getGarageId(), request.getName())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Bay code already exists in this garage: " + request.getName());
        }

        WashBay bay = new WashBay();
        bay.setGarageId(request.getGarageId());
        bay.setBayCode(request.getName());
        bay.setVehicleType(request.getVehicleType());
        bay.setStatus(WashBayStatus.AVAILABLE);
        bay.setIsActive(true);

        return toResponse(washBayRepository.save(bay));
    }

    @Override
    public WashBayResponse getById(Long id) {
        return toResponse(findOrThrow(id));
    }

    @Override
    @Transactional
    public WashBayResponse update(Long id, WashBayUpdateRequest request) {
        WashBay bay = findOrThrow(id);

        if (request.getName() != null) bay.setBayCode(request.getName());
        if (request.getVehicleType() != null) bay.setVehicleType(request.getVehicleType());

        return toResponse(washBayRepository.save(bay));
    }

    @Override
    @Transactional
    public WashBayResponse updateStatus(Long id, WashBayStatusUpdateRequest request) {
        WashBay bay = findOrThrow(id);
        bay.setStatus(request.getStatus());

        // Nếu set INACTIVE thì đồng thời deactivate
        if (request.getStatus() == WashBayStatus.INACTIVE) {
            bay.setIsActive(false);
        }

        return toResponse(washBayRepository.save(bay));
    }

    @Override
    public PageResponse<WashBayResponse> list(int page, int limit, Long garageId,
                                               String vehicleType, WashBayStatus status) {
        Specification<WashBay> spec = Specification
                .where(WashBaySpecifications.garageIdEquals(garageId))
                .and(WashBaySpecifications.vehicleTypeEquals(vehicleType))
                .and(WashBaySpecifications.statusEquals(status));

        Page<WashBay> result = washBayRepository.findAll(spec, PageRequest.of(Math.max(page - 1, 0), limit));

        return PageResponse.<WashBayResponse>builder()
                .data(result.getContent().stream().map(this::toResponse).collect(Collectors.toList()))
                .page(page)
                .limit(limit)
                .totalItems(result.getTotalElements())
                .totalPages(result.getTotalPages())
                .build();
    }

    @Override
    public List<String> getSupportedVehicleTypes(Long garageId) {
        if (!garageRepository.existsById(garageId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,
                    "Garage not found: " + garageId);
        }
        return washBayRepository.findDistinctVehicleTypesByGarageId(garageId);
    }

    @Override
    public WashBayCapacityResponse getCapacity(Long garageId, String vehicleType) {
        if (!garageRepository.existsById(garageId)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,
                    "Garage not found: " + garageId);
        }

        Map<String, Long> countMap = new LinkedHashMap<>();

        if (vehicleType != null) {
            // filter theo 1 vehicle type cụ thể
            long count = washBayRepository.countAvailableByGarageAndVehicleType(garageId, vehicleType);
            countMap.put(vehicleType, count);
        } else {
            // trả về tất cả vehicle types
            List<Object[]> rows = washBayRepository.countAvailableGroupedByVehicleType(garageId);
            for (Object[] row : rows) {
                countMap.put((String) row[0], (Long) row[1]);
            }
        }

        return WashBayCapacityResponse.builder()
                .garageId(garageId)
                .availableCountByVehicleType(countMap)
                .build();
    }

    private WashBay findOrThrow(Long id) {
        return washBayRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Wash bay not found: " + id));
    }

    private WashBayResponse toResponse(WashBay w) {
        return WashBayResponse.builder()
                .id(w.getId())
                .garageId(w.getGarageId())
                .bayCode(w.getBayCode())
                .vehicleType(w.getVehicleType())
                .status(w.getStatus())
                .currentBookingId(w.getCurrentBookingId())
                .isActive(w.getIsActive())
                .createdAt(w.getCreatedAt())
                .updatedAt(w.getUpdatedAt())
                .build();
    }
}