package com.autowashpro.service.impl;

import com.autowashpro.dto.request.*;
import com.autowashpro.dto.response.*;
import com.autowashpro.entity.*;
import com.autowashpro.repository.*;
import com.autowashpro.service.ServicePackageService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class ServicePackageServiceImpl
        implements ServicePackageService {

    private final ServicePackageRepository servicePackageRepository;
    private final ServicePackageIncludeRepository includeRepository;
    private final ServicePackageStepRepository stepRepository;
    private final ServicePackageStepInstructionRepository instructionRepository;
    private final ComboStepResolver comboStepResolver;
    private final GarageRepository garageRepository;
    private final GarageServicePackageRepository garageServicePackageRepository;

    // ── Constants ────────────────────────────────────────────────────────────────
    private static final int WASH_BAY_WINDOW_MAX_MINUTES = 30;

    // ── CREATE ───────────────────────────────────────────────────────────────────

    @Override
    @Transactional
    public ServicePackageResponse create(CreateServicePackageRequest request) {

        // 1. Code uniqueness check
        if (servicePackageRepository.existsByCode(request.getCode())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Code already exists");
        }

        String serviceType = request.getServiceType();
        boolean isCombo = serviceType != null && serviceType.equalsIgnoreCase("COMBO");

        // 2. Validate everything BEFORE any mutation
        List<Garage> validatedGarages = validateAndLoadGarages(request.getGarageIds(), serviceType, false);
        if (!isCombo) {
            validateStepsForRequest(serviceType, request.getSteps());
        }
        if (request.getIncludedServiceIds() != null) {
            for (Long includedId : request.getIncludedServiceIds()) {
                servicePackageRepository.findById(includedId)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                                "Included package not found: " + includedId));
            }
        }

        // 3. Derive washBayDurationMinutes from AUTOMATED_WASH steps (override client value)
        int derivedWashBayDuration = deriveWashBayDurationFromSteps(request.getSteps(), isCombo);

        // 4. Save package
        ServicePackage servicePackage = ServicePackage.builder()
                .name(request.getName())
                .code(request.getCode())
                .vehicleType(request.getVehicleType())
                .serviceType(serviceType)
                .basePrice(request.getBasePrice())
                .durationMinutes(request.getDurationMinutes())
                .washBayDurationMinutes(derivedWashBayDuration)
                .pointsEarned(request.getPointsEarned())
                .requiresWashBay(request.getRequiresWashBay())
                .requiresCareStaff(request.getRequiresCareStaff())
                .careStaffType(request.getCareStaffType())
                .careStaffRequiredCount(request.getCareStaffRequiredCount())
                .careStaffDurationMinutes(request.getCareStaffDurationMinutes())
                .isActive(true)
                .createdAt(LocalDateTime.now())
                .updatedAt(LocalDateTime.now())
                .build();

        servicePackage = servicePackageRepository.save(servicePackage);

        // 5. Save includes
        if (request.getIncludedServiceIds() != null) {
            int sortOrder = 1;
            for (Long includedId : request.getIncludedServiceIds()) {
                ServicePackage included = servicePackageRepository.findById(includedId)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                                "Included package not found: " + includedId));
                includeRepository.save(ServicePackageInclude.builder()
                        .parentServicePackage(servicePackage)
                        .includedServicePackage(included)
                        .sortOrder(sortOrder++)
                        .createdAt(LocalDateTime.now())
                        .updatedAt(LocalDateTime.now())
                        .build());
            }
        }

        // 6. Save steps
        if (request.getSteps() != null) {
            for (CreateServicePackageStepRequest stepRequest : request.getSteps()) {
                ServicePackageStep step = stepRepository.save(ServicePackageStep.builder()
                        .servicePackage(servicePackage)
                        .stepOrder(stepRequest.getStepOrder())
                        .name(stepRequest.getName())
                        .description(stepRequest.getDescription())
                        .isRequired(stepRequest.getIsRequired())
                        .executionPhase(stepRequest.getExecutionPhase())
                        .durationMinutes(stepRequest.getDurationMinutes() != null ? stepRequest.getDurationMinutes() : 0)
                        .createdAt(LocalDateTime.now())
                        .updatedAt(LocalDateTime.now())
                        .build());

                if (stepRequest.getInstructions() != null) {
                    int order = 1;
                    for (String instruction : stepRequest.getInstructions()) {
                        instructionRepository.save(ServicePackageStepInstruction.builder()
                                .servicePackageStep(step)
                                .instructionOrder(order++)
                                .content(instruction)
                                .createdAt(LocalDateTime.now())
                                .updatedAt(LocalDateTime.now())
                                .build());
                    }
                }
            }
        } else if (!isCombo) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                    "SERVICE_STEPS_REQUIRED: MAIN and ADD_ON packages must have at least one valid service step");
        }

        // 7. Save garage mappings
        saveGarageMappings(servicePackage.getId(), validatedGarages);

        return getById(servicePackage.getId());
    }

    // ── UPDATE ───────────────────────────────────────────────────────────────────

    @Override
    @Transactional
    public ServicePackageResponse update(Long id, UpdateServicePackageRequest request) {

        ServicePackage servicePackage = servicePackageRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Service package not found"));

        String serviceType = request.getServiceType();
        boolean isCombo = serviceType != null && serviceType.equalsIgnoreCase("COMBO");

        // 1. Validate everything BEFORE mutation
        List<Garage> validatedGarages = null;
        if (request.getGarageIds() != null) {
            validatedGarages = validateAndLoadGarages(request.getGarageIds(), serviceType, Boolean.TRUE.equals(servicePackage.getIsActive()));
        }
        if (!isCombo && request.getSteps() != null) {
            validateStepsForRequest(serviceType, request.getSteps());
        }
        if (!isCombo && request.getIncludedServiceIds() != null) {
            for (Long includedId : request.getIncludedServiceIds()) {
                if (includedId.equals(id)) {
                    throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Package cannot include itself");
                }
                servicePackageRepository.findById(includedId)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                                "Included package not found: " + includedId));
            }
        }

        // 2. Derive washBayDurationMinutes from steps (if steps are being updated)
        int derivedWashBayDuration;
        if (request.getSteps() != null) {
            derivedWashBayDuration = deriveWashBayDurationFromSteps(request.getSteps(), isCombo);
        } else {
            // Keep existing value if steps not updated
            derivedWashBayDuration = servicePackage.getWashBayDurationMinutes() != null
                    ? servicePackage.getWashBayDurationMinutes() : 0;
        }

        // 3. Update package fields
        servicePackage.setName(request.getName());
        servicePackage.setVehicleType(request.getVehicleType());
        servicePackage.setServiceType(serviceType);
        servicePackage.setBasePrice(request.getBasePrice());
        servicePackage.setDurationMinutes(request.getDurationMinutes());
        servicePackage.setWashBayDurationMinutes(derivedWashBayDuration);
        servicePackage.setPointsEarned(request.getPointsEarned());
        servicePackage.setRequiresWashBay(request.getRequiresWashBay());
        servicePackage.setRequiresCareStaff(request.getRequiresCareStaff());
        servicePackage.setCareStaffType(request.getCareStaffType());
        servicePackage.setCareStaffRequiredCount(request.getCareStaffRequiredCount());
        servicePackage.setCareStaffDurationMinutes(request.getCareStaffDurationMinutes());
        servicePackage.setUpdatedAt(LocalDateTime.now());
        servicePackageRepository.save(servicePackage);

        // 4. Replace steps
        if (request.getSteps() != null) {
            List<ServicePackageStep> existingSteps = stepRepository.findByServicePackage_IdOrderByStepOrder(id);
            for (ServicePackageStep existingStep : existingSteps) {
                instructionRepository.deleteAll(
                        instructionRepository.findByServicePackageStep_IdOrderByInstructionOrder(existingStep.getId()));
            }
            stepRepository.deleteAll(existingSteps);

            for (CreateServicePackageStepRequest stepRequest : request.getSteps()) {
                ServicePackageStep step = stepRepository.save(ServicePackageStep.builder()
                        .servicePackage(servicePackage)
                        .stepOrder(stepRequest.getStepOrder())
                        .name(stepRequest.getName())
                        .description(stepRequest.getDescription())
                        .isRequired(stepRequest.getIsRequired())
                        .executionPhase(stepRequest.getExecutionPhase())
                        .durationMinutes(stepRequest.getDurationMinutes() != null ? stepRequest.getDurationMinutes() : 0)
                        .createdAt(LocalDateTime.now())
                        .updatedAt(LocalDateTime.now())
                        .build());

                if (stepRequest.getInstructions() != null) {
                    int order = 1;
                    for (String instruction : stepRequest.getInstructions()) {
                        instructionRepository.save(ServicePackageStepInstruction.builder()
                                .servicePackageStep(step)
                                .instructionOrder(order++)
                                .content(instruction)
                                .createdAt(LocalDateTime.now())
                                .updatedAt(LocalDateTime.now())
                                .build());
                    }
                }
            }
        }

        // 5. Replace includes
        if (request.getIncludedServiceIds() != null) {
            includeRepository.deleteAll(includeRepository.findByParentServicePackage_Id(id));
            int sortOrder = 1;
            for (Long includedId : request.getIncludedServiceIds()) {
                ServicePackage included = servicePackageRepository.findById(includedId)
                        .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                                "Included package not found: " + includedId));
                includeRepository.save(ServicePackageInclude.builder()
                        .parentServicePackage(servicePackage)
                        .includedServicePackage(included)
                        .sortOrder(sortOrder++)
                        .createdAt(LocalDateTime.now())
                        .updatedAt(LocalDateTime.now())
                        .build());
            }
        }

        // 6. Replace garage mappings (only if caller explicitly sent garageIds)
        if (request.getGarageIds() != null) {
            garageServicePackageRepository.deleteAllByServicePackageId(id);
            saveGarageMappings(id, validatedGarages);
        }

        return getById(id);
    }

    // ── READ ─────────────────────────────────────────────────────────────────────

    @Override
    public List<ServicePackageResponse> getAll() {
        return servicePackageRepository.findAll()
                .stream()
                .map(pkg -> getById(pkg.getId()))
                .toList();
    }

    @Override
    public ServicePackageResponse getById(Long id) {
        ServicePackage servicePackage = servicePackageRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Service package not found"));

        List<Long> includedIds = includeRepository.findByParentServicePackage_Id(id)
                .stream()
                .map(item -> item.getIncludedServicePackage().getId())
                .toList();

        List<Long> garageIds = garageServicePackageRepository.findByServicePackageIdAndIsActiveTrue(id)
                .stream()
                .map(GarageServicePackage::getGarageId)
                .toList();

        List<ServicePackageStep> resolvedSteps = comboStepResolver.resolveSteps(servicePackage);
        List<ServicePackageStepResponse> steps = new ArrayList<>();

        for (int index = 0; index < resolvedSteps.size(); index++) {
            ServicePackageStep step = resolvedSteps.get(index);
            List<ServicePackageInstructionResponse> instructions =
                    instructionRepository.findByServicePackageStep_IdOrderByInstructionOrder(step.getId())
                            .stream()
                            .map(i -> ServicePackageInstructionResponse.builder()
                                    .id(i.getId())
                                    .instructionOrder(i.getInstructionOrder())
                                    .content(i.getContent())
                                    .build())
                            .toList();

            steps.add(ServicePackageStepResponse.builder()
                    .id(step.getId())
                    .stepOrder(index + 1)
                    .name(step.getName())
                    .description(step.getDescription())
                    .isRequired(step.getIsRequired())
                    .instructions(instructions)
                    .executionPhase(step.getExecutionPhase())
                    .durationMinutes(step.getDurationMinutes())
                    .build());
        }

        return ServicePackageResponse.builder()
                .id(servicePackage.getId())
                .name(servicePackage.getName())
                .code(servicePackage.getCode())
                .vehicleType(servicePackage.getVehicleType())
                .serviceType(servicePackage.getServiceType())
                .seatCount(servicePackage.getSeatCount())
                .motorbikeGroup(servicePackage.getMotorbikeGroup())
                .basePrice(servicePackage.getBasePrice())
                .durationMinutes(servicePackage.getDurationMinutes())
                .washBayDurationMinutes(servicePackage.getWashBayDurationMinutes())
                .pointsEarned(servicePackage.getPointsEarned())
                .requiresWashBay(servicePackage.getRequiresWashBay())
                .requiresCareStaff(servicePackage.getRequiresCareStaff())
                .careStaffType(servicePackage.getCareStaffType())
                .careStaffRequiredCount(servicePackage.getCareStaffRequiredCount())
                .careStaffDurationMinutes(servicePackage.getCareStaffDurationMinutes())
                .isActive(servicePackage.getIsActive())
                .includedServiceIds(includedIds)
                .steps(steps)
                .garageIds(garageIds)
                .build();
    }

    // ── STATUS UPDATE ─────────────────────────────────────────────────────────────

    @Override
    @Transactional
    public ServicePackageResponse updateStatus(Long id, UpdateServicePackageStatusRequest request) {
        ServicePackage servicePackage = servicePackageRepository.findById(id)
                .orElseThrow(() -> new RuntimeException("Service package not found"));

        if (Boolean.TRUE.equals(request.getIsActive())) {
            validateStepsForActivation(servicePackage);
            // Must have at least one active garage mapping for MAIN/ADD_ON when activating
            String svcType = servicePackage.getServiceType();
            if (svcType != null && !svcType.equalsIgnoreCase("COMBO")) {
                List<GarageServicePackage> activeMappings =
                        garageServicePackageRepository.findByServicePackageIdAndIsActiveTrue(id);
                if (activeMappings.isEmpty()) {
                    throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                            "GARAGE_REQUIRED: Cannot activate a package with no garage assignments. " +
                            "Assign this package to at least one active garage first.");
                }
            }
        }

        servicePackage.setIsActive(request.getIsActive());
        servicePackageRepository.save(servicePackage);
        return getById(id);
    }

    // ── GET AVAILABLE ─────────────────────────────────────────────────────────────

    @Override
    public List<ServicePackageResponse> getAvailable(String vehicleType, Long garageId) {
        boolean hasVehicleType = vehicleType != null && !vehicleType.isBlank();
        boolean hasGarageId = garageId != null;

        if (hasGarageId) {
            Garage garage = garageRepository.findById(garageId)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                            "Garage not found: " + garageId));
            if (!Boolean.TRUE.equals(garage.getIsActive())) {
                return List.of();
            }
            // Return ONLY packages that have an active mapping to this garage
            List<Long> mappedPackageIds = garageServicePackageRepository.findActivePackageIdsByGarageId(garageId);
            if (mappedPackageIds.isEmpty()) {
                return List.of();
            }
            return servicePackageRepository.findByIsActiveTrue()
                    .stream()
                    .filter(pkg -> mappedPackageIds.contains(pkg.getId()))
                    .filter(pkg -> !hasVehicleType || pkg.getVehicleType().equalsIgnoreCase(vehicleType))
                    .map(pkg -> getById(pkg.getId()))
                    .toList();
        }

        // No garageId — return all active packages matching vehicleType
        return servicePackageRepository.findByIsActiveTrue()
                .stream()
                .filter(pkg -> !hasVehicleType || pkg.getVehicleType().equalsIgnoreCase(vehicleType))
                .map(pkg -> getById(pkg.getId()))
                .toList();
    }

    // ── VALIDATION HELPERS ────────────────────────────────────────────────────────

    private List<Garage> validateAndLoadGarages(List<Long> garageIds, String serviceType, boolean requireAtLeastOne) {
        if (garageIds == null || garageIds.isEmpty()) {
            if (requireAtLeastOne && serviceType != null && !serviceType.equalsIgnoreCase("COMBO")) {
                throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                        "GARAGE_REQUIRED: MAIN and ADD_ON packages must be assigned to at least one garage.");
            }
            return List.of();
        }

        // Duplicate check
        Set<Long> seen = new HashSet<>();
        for (Long gid : garageIds) {
            if (!seen.add(gid)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Duplicate garage ID in garageIds: " + gid);
            }
        }

        List<Garage> garages = new ArrayList<>();
        for (Long gid : garageIds) {
            Garage garage = garageRepository.findById(gid)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                            "Garage not found: " + gid));
            if (!Boolean.TRUE.equals(garage.getIsActive())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                        "Garage is inactive: " + gid);
            }
            garages.add(garage);
        }
        return garages;
    }

    private void saveGarageMappings(Long packageId, List<Garage> garages) {
        if (garages == null || garages.isEmpty()) return;
        LocalDateTime now = LocalDateTime.now();
        for (Garage garage : garages) {
            GarageServicePackage mapping = new GarageServicePackage();
            mapping.setGarageId(garage.getId());
            mapping.setServicePackageId(packageId);
            mapping.setIsActive(true);
            mapping.setCreatedAt(now);
            mapping.setUpdatedAt(now);
            garageServicePackageRepository.save(mapping);
        }
    }

    private int deriveWashBayDurationFromSteps(List<CreateServicePackageStepRequest> steps, boolean isCombo) {
        if (isCombo || steps == null) return 0;
        return steps.stream()
                .filter(s -> "AUTOMATED_WASH".equalsIgnoreCase(s.getExecutionPhase()))
                .mapToInt(s -> s.getDurationMinutes() != null ? s.getDurationMinutes() : 0)
                .sum();
    }

    private void validateStepsForRequest(String serviceType, List<CreateServicePackageStepRequest> steps) {
        if (serviceType == null || serviceType.equalsIgnoreCase("COMBO")) return;
        if (steps == null || steps.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                    "SERVICE_STEPS_REQUIRED: MAIN and ADD_ON packages must have at least one valid service step");
        }
        for (int i = 0; i < steps.size(); i++) {
            CreateServicePackageStepRequest s = steps.get(i);
            if (s.getName() == null || s.getName().isBlank()) {
                throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                        "SERVICE_STEP_INVALID: step " + (i + 1) + " must have a non-blank name");
            }
            if (s.getExecutionPhase() == null || s.getExecutionPhase().isBlank()) {
                throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                        "SERVICE_STEP_INVALID: step " + (i + 1) + " must have an executionPhase");
            }
            int dur = s.getDurationMinutes() != null ? s.getDurationMinutes() : 0;
            if (dur <= 0) {
                throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                        "SERVICE_STEP_INVALID: step " + (i + 1) + " durationMinutes must be > 0");
            }
        }
        int washTotal = steps.stream()
                .filter(s -> "AUTOMATED_WASH".equalsIgnoreCase(s.getExecutionPhase()))
                .mapToInt(s -> s.getDurationMinutes() != null ? s.getDurationMinutes() : 0)
                .sum();
        if (washTotal > WASH_BAY_WINDOW_MAX_MINUTES) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                    "WASH_BAY_WINDOW_EXCEEDED: Automated Wash steps total " + washTotal
                            + " minutes but the wash bay window is limited to " + WASH_BAY_WINDOW_MAX_MINUTES + " minutes");
        }
    }

    private void validateStepsForActivation(ServicePackage pkg) {
        String serviceType = pkg.getServiceType();
        if (serviceType == null) return;
        List<ServicePackageStep> resolved = comboStepResolver.resolveSteps(pkg);
        if (resolved.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                    "SERVICE_STEPS_REQUIRED: Cannot activate a " + serviceType
                            + " package with no effective service steps");
        }
        if (!serviceType.equalsIgnoreCase("COMBO")) {
            for (int i = 0; i < resolved.size(); i++) {
                ServicePackageStep s = resolved.get(i);
                if (s.getName() == null || s.getName().isBlank()) {
                    throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                            "SERVICE_STEP_INVALID: step " + (i + 1) + " must have a non-blank name");
                }
                if (s.getExecutionPhase() == null || s.getExecutionPhase().isBlank()) {
                    throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                            "SERVICE_STEP_INVALID: step " + (i + 1) + " must have an executionPhase");
                }
                if (s.getDurationMinutes() == null || s.getDurationMinutes() <= 0) {
                    throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                            "SERVICE_STEP_INVALID: step " + (i + 1) + " durationMinutes must be > 0");
                }
            }
        }
        int washTotal = resolved.stream()
                .filter(s -> "AUTOMATED_WASH".equalsIgnoreCase(s.getExecutionPhase()))
                .mapToInt(s -> s.getDurationMinutes() != null ? s.getDurationMinutes() : 0)
                .sum();
        if (washTotal > WASH_BAY_WINDOW_MAX_MINUTES) {
            throw new ResponseStatusException(HttpStatus.UNPROCESSABLE_ENTITY,
                    "WASH_BAY_WINDOW_EXCEEDED: Automated Wash steps total " + washTotal
                            + " minutes but the wash bay window is limited to " + WASH_BAY_WINDOW_MAX_MINUTES + " minutes");
        }
    }
}
