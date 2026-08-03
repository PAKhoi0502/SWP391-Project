package com.autowashpro.service.impl;

import com.autowashpro.dto.request.GarageCreateRequest;
import com.autowashpro.dto.request.GarageStatusUpdateRequest;
import com.autowashpro.dto.request.GarageUpdateRequest;
import com.autowashpro.dto.response.GarageCapabilitiesResponse;
import com.autowashpro.dto.response.GarageResponse;
import com.autowashpro.dto.response.NearbyGarageResponse;
import com.autowashpro.dto.response.PageResponse;
import com.autowashpro.entity.Garage;
import com.autowashpro.repository.GarageRepository;
import com.autowashpro.repository.WashBayRepository;
import com.autowashpro.repository.spec.GarageSpecifications;
import com.autowashpro.service.GarageService;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class GarageServiceImpl implements GarageService {

    private final GarageRepository garageRepository;
    private final WashBayRepository washBayRepository;
    private final RestTemplate restTemplate;

    @Value("${vietmap.api-key}")
    private String vietmapApiKey;

    @Value("${vietmap.matrix-url}")
    private String vietmapMatrixUrl;

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
        garage.setLatitude(request.getLatitude());
        garage.setLongitude(request.getLongitude());
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
        if (request.getLatitude() != null) garage.setLatitude(request.getLatitude());
        if (request.getLongitude() != null) garage.setLongitude(request.getLongitude());

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
        Specification<Garage> spec = ((Specification<Garage>) (root, query, cb) -> null)
                .and(GarageSpecifications.isActiveEquals(isActive))
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
    public List<NearbyGarageResponse> findNearest(double lat, double lng, int limit) {
        List<Garage> garages = garageRepository.findByIsActiveTrueAndLatitudeIsNotNullAndLongitudeIsNotNull();
        if (garages.isEmpty()) {
            return List.of();
        }

        Map<Garage, double[]> distanceByGarage = fetchDistancesFromVietMap(lat, lng, garages);
        if (distanceByGarage == null) {
            distanceByGarage = haversineFallback(lat, lng, garages);
        }

        Map<Garage, double[]> distances = distanceByGarage;
        return garages.stream()
                .sorted(Comparator.comparingDouble(g -> distances.get(g)[0]))
                .limit(Math.max(limit, 1))
                .map(g -> {
                    double[] distanceAndDuration = distances.get(g);
                    return NearbyGarageResponse.builder()
                            .garage(toResponse(g))
                            .distanceKm(Math.round(distanceAndDuration[0] / 100.0) / 10.0)
                            .durationMinutes((int) Math.round(distanceAndDuration[1] / 60.0))
                            .build();
                })
                .collect(Collectors.toList());
    }

    @SuppressWarnings("unchecked")
    private Map<Garage, double[]> fetchDistancesFromVietMap(double lat, double lng, List<Garage> garages) {
        try {
            StringBuilder url = new StringBuilder(vietmapMatrixUrl)
                    .append("?apikey=").append(vietmapApiKey)
                    .append("&vehicle=car")
                    .append("&point=").append(lat).append(",").append(lng);
            for (Garage g : garages) {
                url.append("&point=").append(g.getLatitude()).append(",").append(g.getLongitude());
            }
            StringBuilder destinations = new StringBuilder();
            for (int i = 1; i <= garages.size(); i++) {
                if (i > 1) destinations.append(";");
                destinations.append(i);
            }
            url.append("&sources=0&destinations=").append(destinations);

            Map<String, Object> response = restTemplate.getForObject(url.toString(), Map.class);
            if (response == null || !"OK".equals(response.get("code"))) {
                log.warn("VietMap matrix call returned no result or non-OK code: {}", response);
                return null;
            }

            List<List<Number>> distances = (List<List<Number>>) response.get("distances");
            List<List<Number>> durations = (List<List<Number>>) response.get("durations");
            if (distances == null || durations == null || distances.isEmpty() || durations.isEmpty()) {
                return null;
            }

            List<Number> distanceRow = distances.get(0);
            List<Number> durationRow = durations.get(0);

            Map<Garage, double[]> result = new HashMap<>();
            for (int i = 0; i < garages.size(); i++) {
                result.put(garages.get(i), new double[] {
                        distanceRow.get(i).doubleValue(),
                        durationRow.get(i).doubleValue(),
                });
            }
            return result;
        } catch (Exception e) {
            log.warn("VietMap matrix call failed, falling back to straight-line distance: {}", e.getMessage());
            return null;
        }
    }

    private Map<Garage, double[]> haversineFallback(double lat, double lng, List<Garage> garages) {
        Map<Garage, double[]> result = new HashMap<>();
        for (Garage g : garages) {
            double meters = haversineMeters(lat, lng, g.getLatitude(), g.getLongitude());
            double estimatedSeconds = meters / 1000.0 / 30.0 * 3600.0; // assume ~30 km/h average city driving speed
            result.put(g, new double[] { meters, estimatedSeconds });
        }
        return result;
    }

    private double haversineMeters(double lat1, double lng1, double lat2, double lng2) {
        double earthRadiusMeters = 6371000.0;
        double dLat = Math.toRadians(lat2 - lat1);
        double dLng = Math.toRadians(lng2 - lng1);
        double a = Math.sin(dLat / 2) * Math.sin(dLat / 2)
                + Math.cos(Math.toRadians(lat1)) * Math.cos(Math.toRadians(lat2))
                * Math.sin(dLng / 2) * Math.sin(dLng / 2);
        double c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return earthRadiusMeters * c;
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
                .latitude(g.getLatitude())
                .longitude(g.getLongitude())
                .isActive(g.getIsActive())
                .createdAt(g.getCreatedAt())
                .updatedAt(g.getUpdatedAt())
                .build();
    }
}