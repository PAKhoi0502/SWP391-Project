package com.autowashpro.service.impl;

import com.autowashpro.dto.request.VehicleCreateRequest;
import com.autowashpro.dto.request.VehicleStatusUpdateRequest;
import com.autowashpro.dto.request.VehicleUpdateRequest;
import com.autowashpro.dto.response.PageResponse;
import com.autowashpro.dto.response.VehicleResponse;
import com.autowashpro.entity.User;
import com.autowashpro.entity.Vehicle;
import com.autowashpro.repository.UserRepository;
import com.autowashpro.repository.VehicleRepository;
import com.autowashpro.repository.spec.VehicleSpecifications;
import com.autowashpro.service.VehicleService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class VehicleServiceImpl implements VehicleService {

    private final VehicleRepository vehicleRepository;
    private final UserRepository userRepository;

    // Chuẩn hóa biển số: uppercase, xóa dấu chấm/gạch/khoảng trắng
    private String normalizePlate(String raw) {
        return raw.toUpperCase()
                .replaceAll("[\\s.\\-]", "")
                .replaceAll("[^A-Z0-9]", "");
    }

    @Override
    @Transactional
    public VehicleResponse create(VehicleCreateRequest request, Long customerId) {
        User customer = userRepository.findById(customerId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Customer not found: " + customerId));

        String normalized = normalizePlate(request.getRawLicensePlate());

        if (vehicleRepository.existsByNormalizedLicensePlateAndIsActiveTrue(normalized)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "License plate already exists: " + normalized);
        }

        Vehicle vehicle = new Vehicle();
        vehicle.setCustomer(customer);
        vehicle.setRawLicensePlate(request.getRawLicensePlate());
        vehicle.setNormalizedLicensePlate(normalized);
        vehicle.setVehicleType(request.getVehicleType());
        vehicle.setEngineType(request.getEngineType());
        vehicle.setBrand(request.getBrand());
        vehicle.setModel(request.getModel());
        vehicle.setColor(request.getColor());
        vehicle.setSeatCount(request.getSeatCount());
        vehicle.setMotorbikeGroup(request.getMotorbikeGroup());
        vehicle.setIsActive(true);

        // Nếu là xe đầu tiên hoặc request muốn set default
        boolean setDefault = Boolean.TRUE.equals(request.getIsDefault())
                || vehicleRepository.findByCustomer_IdAndIsActiveTrue(customerId).isEmpty();

        if (setDefault) {
            vehicleRepository.clearDefaultByCustomerId(customerId);
            vehicle.setIsDefault(true);
        } else {
            vehicle.setIsDefault(false);
        }

        return toResponse(vehicleRepository.save(vehicle));
    }

    @Override
    public List<VehicleResponse> listOwn(Long customerId) {
        return vehicleRepository.findByCustomer_IdAndIsActiveTrue(customerId)
                .stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Override
    public VehicleResponse getOwnById(Long id, Long customerId) {
        Vehicle vehicle = vehicleRepository.findByIdAndCustomer_Id(id, customerId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Vehicle not found or not owned by current user"));
        return toResponse(vehicle);
    }

    @Override
    @Transactional
    public VehicleResponse update(Long id, VehicleUpdateRequest request, Long customerId) {
        Vehicle vehicle = vehicleRepository.findByIdAndCustomer_Id(id, customerId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Vehicle not found or not owned by current user"));

        if (request.getBrand() != null) vehicle.setBrand(request.getBrand());
        if (request.getModel() != null) vehicle.setModel(request.getModel());
        if (request.getColor() != null) vehicle.setColor(request.getColor());
        if (request.getEngineType() != null) vehicle.setEngineType(request.getEngineType());
        if (request.getSeatCount() != null) vehicle.setSeatCount(request.getSeatCount());
        if (request.getMotorbikeGroup() != null) vehicle.setMotorbikeGroup(request.getMotorbikeGroup());

        return toResponse(vehicleRepository.save(vehicle));
    }

    @Override
    @Transactional
    public VehicleResponse setDefault(Long id, Long customerId) {
        Vehicle vehicle = vehicleRepository.findByIdAndCustomer_Id(id, customerId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Vehicle not found or not owned by current user"));

        if (!Boolean.TRUE.equals(vehicle.getIsActive())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Cannot set inactive vehicle as default");
        }

        vehicleRepository.clearDefaultByCustomerId(customerId);
        vehicle.setIsDefault(true);

        return toResponse(vehicleRepository.save(vehicle));
    }

    @Override
    @Transactional
    public VehicleResponse updateStatus(Long id, VehicleStatusUpdateRequest request, Long customerId) {
        Vehicle vehicle = vehicleRepository.findByIdAndCustomer_Id(id, customerId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Vehicle not found or not owned by current user"));

        vehicle.setIsActive(request.getIsActive());

        // Nếu deactivate xe đang là default, clear default
        if (!Boolean.TRUE.equals(request.getIsActive())
                && Boolean.TRUE.equals(vehicle.getIsDefault())) {
            vehicle.setIsDefault(false);
        }

        return toResponse(vehicleRepository.save(vehicle));
    }

    @Override
    public PageResponse<VehicleResponse> adminList(int page, int limit,
                                                    String vehicleType, String keyword) {
        Specification<Vehicle> spec = Specification
                .where(VehicleSpecifications.vehicleTypeEquals(vehicleType))
                .and(VehicleSpecifications.keywordContains(keyword));

        Page<Vehicle> result = vehicleRepository.findAll(spec,
                PageRequest.of(Math.max(page - 1, 0), limit));

        return PageResponse.<VehicleResponse>builder()
                .data(result.getContent().stream().map(this::toResponse).collect(Collectors.toList()))
                .page(page)
                .limit(limit)
                .totalItems(result.getTotalElements())
                .totalPages(result.getTotalPages())
                .build();
    }

    @Override
    public void assertVehicleIsActive(Long vehicleId) {
        Vehicle vehicle = vehicleRepository.findById(vehicleId)
                .orElseThrow(() -> new ResponseStatusException(
                        HttpStatus.NOT_FOUND, "Vehicle not found: " + vehicleId));
        if (!Boolean.TRUE.equals(vehicle.getIsActive())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Vehicle is inactive: " + vehicleId);
        }
    }

    private VehicleResponse toResponse(Vehicle v) {
        return VehicleResponse.builder()
                .id(v.getId())
                .customerId(v.getCustomer() != null ? v.getCustomer().getId() : null)
                .rawLicensePlate(v.getRawLicensePlate())
                .normalizedLicensePlate(v.getNormalizedLicensePlate())
                .vehicleType(v.getVehicleType())
                .engineType(v.getEngineType())
                .brand(v.getBrand())
                .model(v.getModel())
                .color(v.getColor())
                .seatCount(v.getSeatCount())
                .motorbikeGroup(v.getMotorbikeGroup())
                .isDefault(v.getIsDefault())
                .isActive(v.getIsActive())
                .createdAt(v.getCreatedAt())
                .updatedAt(v.getUpdatedAt())
                .build();
    }
}