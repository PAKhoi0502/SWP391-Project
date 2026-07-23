package com.autowashpro.service.impl;

import com.autowashpro.dto.request.CreateServicePackageRequest;
import com.autowashpro.dto.request.CreateServicePackageStepRequest;
import com.autowashpro.entity.ServicePackage;
import com.autowashpro.entity.ServicePackageStep;
import com.autowashpro.repository.GarageRepository;
import com.autowashpro.repository.GarageServicePackageRepository;
import com.autowashpro.repository.ServicePackageIncludeRepository;
import com.autowashpro.repository.ServicePackageRepository;
import com.autowashpro.repository.ServicePackageStepInstructionRepository;
import com.autowashpro.repository.ServicePackageStepRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ServicePackageWashBayWindowTest {

    @Mock private ServicePackageRepository servicePackageRepository;
    @Mock private ServicePackageIncludeRepository includeRepository;
    @Mock private ServicePackageStepRepository stepRepository;
    @Mock private ServicePackageStepInstructionRepository instructionRepository;
    @Mock private ComboStepResolver comboStepResolver;
    @Mock private GarageRepository garageRepository;
    @Mock private GarageServicePackageRepository garageServicePackageRepository;

    @InjectMocks
    private ServicePackageServiceImpl service;

    private final AtomicLong idSeq = new AtomicLong(1);
    private final List<ServicePackageStep> savedSteps = new ArrayList<>();

    @BeforeEach
    void setUp() {
        when(servicePackageRepository.existsByCode(any())).thenReturn(false);
        when(servicePackageRepository.save(any(ServicePackage.class))).thenAnswer(inv -> {
            ServicePackage p = inv.getArgument(0);
            if (p.getId() == null) p.setId(idSeq.getAndIncrement());
            return p;
        });
        when(servicePackageRepository.findById(anyLong())).thenAnswer(inv ->
                Optional.of(minimalPackage((Long) inv.getArgument(0))));
        when(stepRepository.save(any(ServicePackageStep.class))).thenAnswer(inv -> {
            ServicePackageStep s = inv.getArgument(0);
            s.setId(idSeq.getAndIncrement());
            savedSteps.add(s);
            return s;
        });
        when(instructionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(includeRepository.findByParentServicePackage_Id(anyLong())).thenReturn(List.of());
        when(comboStepResolver.resolveSteps(any())).thenReturn(savedSteps);
        when(instructionRepository.findByServicePackageStep_IdOrderByInstructionOrder(anyLong()))
                .thenReturn(List.of());
    }

    private static ServicePackage minimalPackage(Long id) {
        return ServicePackage.builder()
                .id(id).serviceType("MAIN").vehicleType("CAR")
                .basePrice(BigDecimal.valueOf(100_000)).durationMinutes(30)
                .washBayDurationMinutes(30).pointsEarned(0)
                .requiresWashBay(true).requiresCareStaff(false)
                .isActive(true).build();
    }

    private static CreateServicePackageRequest request(List<CreateServicePackageStepRequest> steps) {
        CreateServicePackageRequest r = new CreateServicePackageRequest();
        r.setName("Test Package");
        r.setCode("TEST-" + System.nanoTime());
        r.setVehicleType("CAR");
        r.setServiceType("MAIN");
        r.setBasePrice(BigDecimal.valueOf(100_000));
        r.setDurationMinutes(45);
        r.setWashBayDurationMinutes(30);
        r.setPointsEarned(0);
        r.setRequiresWashBay(true);
        r.setRequiresCareStaff(false);
        r.setIncludedServiceIds(List.of());
        r.setSteps(steps);
        return r;
    }

    private static CreateServicePackageStepRequest step(String phase, int minutes) {
        return new CreateServicePackageStepRequest(
                1, "Step", "Step desc", true, List.of(), phase, minutes);
    }

    // === 1: Wash total exactly 30 min — accepted ===
    @Test
    void washStepTotalExactly30Min_accepted() {
        assertDoesNotThrow(() -> service.create(request(List.of(step("AUTOMATED_WASH", 30)))));
    }

    // === 2: Wash total 31 min — rejected with 422 WASH_BAY_WINDOW_EXCEEDED ===
    @Test
    void washStepTotal31Min_rejected() {
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.create(request(List.of(step("AUTOMATED_WASH", 20), step("AUTOMATED_WASH", 11)))));
        assertEquals(422, ex.getStatusCode().value());
        assertTrue(ex.getReason().contains("WASH_BAY_WINDOW_EXCEEDED"),
                "Expected WASH_BAY_WINDOW_EXCEEDED, got: " + ex.getReason());
    }

    // === 3: Care-only 60 min — accepted (no wash bay window constraint) ===
    @Test
    void careOnlyPackage60Min_accepted() {
        assertDoesNotThrow(() -> service.create(request(List.of(step("VEHICLE_CARE", 60)))));
    }

    // === 4: Mixed wash 30 + care 60 — accepted ===
    @Test
    void mixedWash30AndCare60_accepted() {
        assertDoesNotThrow(() ->
                service.create(request(List.of(step("AUTOMATED_WASH", 30), step("VEHICLE_CARE", 60)))));
    }

    // === 5: Step duration = 0 — rejected with SERVICE_STEP_INVALID ===
    @Test
    void stepDuration0_rejected() {
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.create(request(List.of(step("AUTOMATED_WASH", 0)))));
        assertTrue(ex.getReason().contains("SERVICE_STEP_INVALID"),
                "Expected SERVICE_STEP_INVALID, got: " + ex.getReason());
    }

    // === 6: Step duration negative — rejected with SERVICE_STEP_INVALID ===
    @Test
    void stepDurationNegative_rejected() {
        ResponseStatusException ex = assertThrows(ResponseStatusException.class,
                () -> service.create(request(List.of(step("AUTOMATED_WASH", -5)))));
        assertTrue(ex.getReason().contains("SERVICE_STEP_INVALID"),
                "Expected SERVICE_STEP_INVALID, got: " + ex.getReason());
    }

    // === 7: COMBO type — skips wash window check at create time ===
    @Test
    void comboType_skipsWashWindowCheckAtCreate() {
        CreateServicePackageRequest r = request(null);
        r.setServiceType("COMBO");
        r.setSteps(null);
        assertDoesNotThrow(() -> service.create(r));
    }
}
