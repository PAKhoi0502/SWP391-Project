package com.autowashpro.service.impl;

import com.autowashpro.dto.request.*;
import com.autowashpro.dto.response.*;
import com.autowashpro.entity.*;
import com.autowashpro.repository.*;
import com.autowashpro.service.ServicePackageService;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class ServicePackageServiceImpl
        implements ServicePackageService {

    private final ServicePackageRepository servicePackageRepository;
    private final ServicePackageIncludeRepository includeRepository;
    private final ServicePackageStepRepository stepRepository;
    private final ServicePackageStepInstructionRepository instructionRepository;

    @Override
    public ServicePackageResponse create(
            CreateServicePackageRequest request) {

        if (servicePackageRepository.existsByCode(
                request.getCode())) {

            throw new RuntimeException(
                    "Code already exists");
        }

        ServicePackage servicePackage =
                ServicePackage.builder()
                        .name(request.getName())
                        .code(request.getCode())
                        .vehicleType(request.getVehicleType())
                        .serviceType(request.getServiceType())
                        .basePrice(request.getBasePrice())
                        .durationMinutes(
                                request.getDurationMinutes())
                        .washBayDurationMinutes(
                                request.getWashBayDurationMinutes())
                        .pointsEarned(
                                request.getPointsEarned())
                        .requiresWashBay(
                                request.getRequiresWashBay())
                        .requiresCareStaff(
                                request.getRequiresCareStaff())
                        .careStaffType(
                                request.getCareStaffType())
                        .careStaffRequiredCount(
                                request.getCareStaffRequiredCount())
                        .careStaffDurationMinutes(
                                request.getCareStaffDurationMinutes())
                        .isActive(true)
                        .createdAt(LocalDateTime.now())
                        .updatedAt(LocalDateTime.now())
                        .build();

        servicePackage =
                servicePackageRepository.save(
                        servicePackage);

        if (request.getIncludedServiceIds() != null) {

            int sortOrder = 1;

            for (Long includedId :
                    request.getIncludedServiceIds()) {

                ServicePackage included =
                        servicePackageRepository.findById(
                                includedId)
                                .orElseThrow(() ->
                                        new RuntimeException(
                                                "Included package not found"));

                includeRepository.save(
                        ServicePackageInclude.builder()
                                .parentServicePackage(
                                        servicePackage)
                                .includedServicePackage(
                                        included)
                                .sortOrder(sortOrder++)
                                .createdAt(
                                        LocalDateTime.now())
                                .updatedAt(
                                        LocalDateTime.now())
                                .build());
            }
        }

        if (request.getSteps() != null) {

            for (CreateServicePackageStepRequest stepRequest :
                    request.getSteps()) {

                ServicePackageStep step =
                        stepRepository.save(
                                ServicePackageStep.builder()
                                        .servicePackage(
                                                servicePackage)
                                        .stepOrder(
                                                stepRequest.getStepOrder())
                                        .name(
                                                stepRequest.getName())
                                        .description(
                                                stepRequest.getDescription())
                                        .isRequired(
                                                stepRequest.getIsRequired())
                                        .createdAt(
                                                LocalDateTime.now())
                                        .updatedAt(
                                                LocalDateTime.now())
                                        .build());

                if (stepRequest.getInstructions() != null) {

                    int order = 1;

                    for (String instruction :
                            stepRequest.getInstructions()) {

                        instructionRepository.save(
                                ServicePackageStepInstruction
                                        .builder()
                                        .servicePackageStep(
                                                step)
                                        .instructionOrder(
                                                order++)
                                        .content(
                                                instruction)
                                        .createdAt(
                                                LocalDateTime.now())
                                        .updatedAt(
                                                LocalDateTime.now())
                                        .build());
                    }
                }
            }
        }

        return getById(servicePackage.getId());
    }

    @Override
    public List<ServicePackageResponse> getAll() {

        return servicePackageRepository.findAll()
                .stream()
                .map(servicePackage ->
                        getById(servicePackage.getId()))
                .toList();
    }

    @Override
    public ServicePackageResponse getById(Long id) {

        ServicePackage servicePackage =
                servicePackageRepository.findById(id)
                        .orElseThrow(() ->
                                new RuntimeException(
                                        "Service package not found"));

        List<Long> includedIds =
                includeRepository
                        .findByParentServicePackage_Id(id)
                        .stream()
                        .map(item ->
                                item.getIncludedServicePackage()
                                        .getId())
                        .toList();

        List<ServicePackageStepResponse> steps =
                stepRepository
                        .findByServicePackage_IdOrderByStepOrder(
                                id)
                        .stream()
                        .map(step -> {

                            List<ServicePackageInstructionResponse>
                                    instructions =
                                    instructionRepository
                                            .findByServicePackageStep_IdOrderByInstructionOrder(
                                                    step.getId())
                                            .stream()
                                            .map(i ->
                                                    ServicePackageInstructionResponse
                                                            .builder()
                                                            .id(i.getId())
                                                            .instructionOrder(
                                                                    i.getInstructionOrder())
                                                            .content(
                                                                    i.getContent())
                                                            .build())
                                            .toList();

                            return ServicePackageStepResponse
                                    .builder()
                                    .id(step.getId())
                                    .stepOrder(
                                            step.getStepOrder())
                                    .name(step.getName())
                                    .description(
                                            step.getDescription())
                                    .isRequired(
                                            step.getIsRequired())
                                    .instructions(
                                            instructions)
                                    .build();
                        })
                        .toList();

        return ServicePackageResponse.builder()
                .id(servicePackage.getId())
                .name(servicePackage.getName())
                .code(servicePackage.getCode())
                .vehicleType(
                        servicePackage.getVehicleType())
                .serviceType(
                        servicePackage.getServiceType())
                .basePrice(
                        servicePackage.getBasePrice())
                .durationMinutes(
                        servicePackage.getDurationMinutes())
                .washBayDurationMinutes(
                        servicePackage.getWashBayDurationMinutes())
                .pointsEarned(
                        servicePackage.getPointsEarned())
                .requiresWashBay(
                        servicePackage.getRequiresWashBay())
                .requiresCareStaff(
                        servicePackage.getRequiresCareStaff())
                .careStaffType(
                        servicePackage.getCareStaffType())
                .careStaffRequiredCount(
                        servicePackage.getCareStaffRequiredCount())
                .careStaffDurationMinutes(
                        servicePackage.getCareStaffDurationMinutes())
                .isActive(
                        servicePackage.getIsActive())
                .includedServiceIds(
                        includedIds)
                .steps(
                        steps)
                .build();
    }

    @Override
    public ServicePackageResponse update(
            Long id,
            UpdateServicePackageRequest request) {

        ServicePackage servicePackage =
                servicePackageRepository.findById(id)
                        .orElseThrow(() ->
                                new RuntimeException(
                                        "Service package not found"));

        servicePackage.setName(
                request.getName());
        servicePackage.setVehicleType(
                request.getVehicleType());
        servicePackage.setServiceType(
                request.getServiceType());
        servicePackage.setBasePrice(
                request.getBasePrice());
        servicePackage.setDurationMinutes(
                request.getDurationMinutes());
        servicePackage.setWashBayDurationMinutes(
                request.getWashBayDurationMinutes());
        servicePackage.setPointsEarned(
                request.getPointsEarned());
        servicePackage.setRequiresWashBay(
                request.getRequiresWashBay());
        servicePackage.setRequiresCareStaff(
                request.getRequiresCareStaff());
        servicePackage.setCareStaffType(
                request.getCareStaffType());
        servicePackage.setCareStaffRequiredCount(
                request.getCareStaffRequiredCount());
        servicePackage.setCareStaffDurationMinutes(
                request.getCareStaffDurationMinutes());
        servicePackage.setUpdatedAt(
                LocalDateTime.now());

        servicePackageRepository.save(
                servicePackage);

        return getById(id);
    }

    @Override
    public ServicePackageResponse updateStatus(
            Long id,
            UpdateServicePackageStatusRequest request) {

        ServicePackage servicePackage =
                servicePackageRepository.findById(id)
                        .orElseThrow(() ->
                                new RuntimeException(
                                        "Service package not found"));

        servicePackage.setIsActive(
                request.getIsActive());

        servicePackageRepository.save(
                servicePackage);

        return getById(id);
    }
    @Override
public List<ServicePackageResponse> getAvailable(
        String vehicleType) {

    return servicePackageRepository.findAll()
            .stream()
            .filter(ServicePackage::getIsActive)
            .filter(servicePackage ->
                    servicePackage.getVehicleType()
                            .equalsIgnoreCase(vehicleType))
            .map(servicePackage ->
                    getById(servicePackage.getId()))
            .toList();
}
}