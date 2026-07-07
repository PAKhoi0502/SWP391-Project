package com.autowashpro.service.impl;

import com.autowashpro.dto.request.CreateServicePackageRequest;
import com.autowashpro.dto.request.UpdateServicePackageStatusRequest;
import com.autowashpro.dto.response.ServicePackageResponse;
import com.autowashpro.entity.ServicePackage;
import com.autowashpro.entity.ServicePackageInclude;
import com.autowashpro.entity.ServicePackageStep;
import com.autowashpro.entity.ServicePackageStepInstruction;
import com.autowashpro.repository.ServicePackageIncludeRepository;
import com.autowashpro.repository.ServicePackageRepository;
import com.autowashpro.repository.ServicePackageStepInstructionRepository;
import com.autowashpro.repository.ServicePackageStepRepository;
import com.autowashpro.support.TestFixtures;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicReference;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ServicePackageServiceImplTest {

    @Mock
    private ServicePackageRepository servicePackageRepository;

    @Mock
    private ServicePackageIncludeRepository includeRepository;

    @Mock
    private ServicePackageStepRepository stepRepository;

    @Mock
    private ServicePackageStepInstructionRepository instructionRepository;

    @Mock
    private ComboStepResolver comboStepResolver;

    @InjectMocks
    private ServicePackageServiceImpl servicePackageService;

    private final AtomicReference<ServicePackage> savedPackage = new AtomicReference<>();
    private final List<ServicePackageStep> savedSteps = new ArrayList<>();
    private final List<ServicePackageInclude> savedIncludes = new ArrayList<>();
    private final Map<Long, List<ServicePackageStepInstruction>> instructionsByStep = new HashMap<>();

    @BeforeEach
    void setUpRepositoryAnswers() {
        when(servicePackageRepository.save(any(ServicePackage.class))).thenAnswer(invocation -> {
            ServicePackage servicePackage = invocation.getArgument(0);
            if (servicePackage.getId() == null) {
                servicePackage.setId(1L);
            }
            savedPackage.set(servicePackage);
            return servicePackage;
        });
        when(servicePackageRepository.findById(1L))
                .thenAnswer(invocation -> Optional.ofNullable(savedPackage.get()));
        when(stepRepository.save(any(ServicePackageStep.class))).thenAnswer(invocation -> {
            ServicePackageStep step = invocation.getArgument(0);
            step.setId((long) savedSteps.size() + 1);
            savedSteps.add(step);
            return step;
        });
        when(instructionRepository.save(any(ServicePackageStepInstruction.class))).thenAnswer(invocation -> {
            ServicePackageStepInstruction instruction = invocation.getArgument(0);
            Long stepId = instruction.getServicePackageStep().getId();
            List<ServicePackageStepInstruction> instructions = instructionsByStep
                    .computeIfAbsent(stepId, ignored -> new ArrayList<>());
            instruction.setId((long) instructions.size() + 1);
            instructions.add(instruction);
            return instruction;
        });
        when(includeRepository.save(any(ServicePackageInclude.class))).thenAnswer(invocation -> {
            ServicePackageInclude include = invocation.getArgument(0);
            include.setId((long) savedIncludes.size() + 1);
            savedIncludes.add(include);
            return include;
        });
        when(includeRepository.findByParentServicePackage_Id(1L)).thenReturn(savedIncludes);
        when(comboStepResolver.resolveSteps(any(ServicePackage.class))).thenReturn(savedSteps);
        when(instructionRepository.findByServicePackageStep_IdOrderByInstructionOrder(anyLong()))
                .thenAnswer(invocation -> instructionsByStep.getOrDefault(invocation.getArgument(0), List.of()));
    }

    @Test
    void createPersistsMainPackageStepsAndInstructions() {
        CreateServicePackageRequest request = TestFixtures.servicePackageCreateRequest();

        ServicePackageResponse response = servicePackageService.create(request);

        assertEquals("MAIN", response.getServiceType());
        assertEquals(1, response.getSteps().size());
        assertEquals(2, response.getSteps().get(0).getInstructions().size());
        assertEquals("Apply foam", response.getSteps().get(0).getInstructions().get(0).getContent());
    }

    @Test
    void createRejectsDuplicateCode() {
        CreateServicePackageRequest request = TestFixtures.servicePackageCreateRequest();
        when(servicePackageRepository.existsByCode(request.getCode())).thenReturn(true);

        RuntimeException error = assertThrows(RuntimeException.class,
                () -> servicePackageService.create(request));

        assertEquals("Code already exists", error.getMessage());
        verify(servicePackageRepository, never()).save(any());
    }

    @Test
    void createComboPersistsIncludedPackagesInOrder() {
        CreateServicePackageRequest request = TestFixtures.servicePackageCreateRequest();
        request.setServiceType("COMBO");
        request.setSteps(null);
        request.setIncludedServiceIds(List.of(2L, 3L));
        ServicePackage main = TestFixtures.carWashPackage();
        main.setId(2L);
        ServicePackage addOn = TestFixtures.carWashPackage();
        addOn.setId(3L);
        addOn.setServiceType("ADD_ON");
        when(servicePackageRepository.findById(2L)).thenReturn(Optional.of(main));
        when(servicePackageRepository.findById(3L)).thenReturn(Optional.of(addOn));

        ServicePackageResponse response = servicePackageService.create(request);

        assertEquals(List.of(2L, 3L), response.getIncludedServiceIds());
        assertEquals(1, savedIncludes.get(0).getSortOrder());
        assertEquals(2, savedIncludes.get(1).getSortOrder());
    }

    @Test
    void createRejectsMissingIncludedPackage() {
        CreateServicePackageRequest request = TestFixtures.servicePackageCreateRequest();
        request.setServiceType("COMBO");
        request.setIncludedServiceIds(List.of(99L));
        when(servicePackageRepository.findById(99L)).thenReturn(Optional.empty());

        RuntimeException error = assertThrows(RuntimeException.class,
                () -> servicePackageService.create(request));

        assertEquals("Included package not found", error.getMessage());
    }

    @Test
    void getByIdRejectsMissingPackage() {
        when(servicePackageRepository.findById(99L)).thenReturn(Optional.empty());

        RuntimeException error = assertThrows(RuntimeException.class,
                () -> servicePackageService.getById(99L));

        assertEquals("Service package not found", error.getMessage());
    }

    @Test
    void updateStatusDeactivatesPackage() {
        ServicePackage servicePackage = TestFixtures.carWashPackage();
        savedPackage.set(servicePackage);
        UpdateServicePackageStatusRequest request = new UpdateServicePackageStatusRequest(false);

        ServicePackageResponse response = servicePackageService.updateStatus(servicePackage.getId(), request);

        assertFalse(response.getIsActive());
        verify(servicePackageRepository).save(servicePackage);
    }

    @Test
    void getAvailableReturnsOnlyActiveMatchingVehicleType() {
        ServicePackage activeCar = TestFixtures.carWashPackage();
        ServicePackage inactiveCar = TestFixtures.carWashPackage();
        inactiveCar.setId(2L);
        inactiveCar.setIsActive(false);
        ServicePackage activeBike = TestFixtures.carWashPackage();
        activeBike.setId(3L);
        activeBike.setVehicleType("BIKE");
        when(servicePackageRepository.findAll()).thenReturn(List.of(activeCar, inactiveCar, activeBike));
        when(servicePackageRepository.findById(activeCar.getId())).thenReturn(Optional.of(activeCar));

        List<ServicePackageResponse> responses = servicePackageService.getAvailable("CAR");

        assertEquals(1, responses.size());
        assertEquals("CAR", responses.get(0).getVehicleType());
    }
}
