package com.autowashpro.service.impl;

import com.autowashpro.dto.request.CreateServicePackageRequest;
import com.autowashpro.dto.request.CreateServicePackageStepRequest;
import com.autowashpro.dto.response.ServicePackageResponse;
import com.autowashpro.entity.Garage;
import com.autowashpro.entity.ServicePackage;
import com.autowashpro.entity.ServicePackageStep;
import com.autowashpro.repository.GarageRepository;
import com.autowashpro.repository.GarageServicePackageRepository;
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
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class GaragePackageMappingTest {

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
        when(garageServicePackageRepository.findByServicePackageIdAndIsActiveTrue(anyLong()))
                .thenReturn(List.of());
    }

    // ── 1: create with valid garages saves mappings ──────────────────────────

    @Test
    void createWithValidGarages_savesMappings() {
        Garage g1 = TestFixtures.garage();
        g1.setId(10L);
        when(garageRepository.findAllById(List.of(10L))).thenReturn(List.of(g1));
        when(garageRepository.findById(10L)).thenReturn(Optional.of(g1));

        CreateServicePackageRequest req = minimalRequest();
        req.setGarageIds(List.of(10L));

        assertDoesNotThrow(() -> service.create(req));

        verify(garageServicePackageRepository).save(any());
    }

    // ── 2: create with inactive garage → rejected ────────────────────────────

    @Test
    void createWithInactiveGarage_rejected() {
        Garage inactive = TestFixtures.garage();
        inactive.setId(20L);
        inactive.setIsActive(false);
        when(garageRepository.findById(20L)).thenReturn(Optional.of(inactive));

        CreateServicePackageRequest req = minimalRequest();
        req.setGarageIds(List.of(20L));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () -> service.create(req));
        assertTrue(ex.getReason().contains("GARAGE_NOT_ACTIVE") || ex.getMessage().contains("inactive"),
                "Expected GARAGE_NOT_ACTIVE, got: " + ex.getReason());
    }

    // ── 3: create with non-existent garage ID → rejected ────────────────────

    @Test
    void createWithMissingGarageId_rejected() {
        when(garageRepository.findAllById(List.of(99L))).thenReturn(List.of());

        CreateServicePackageRequest req = minimalRequest();
        req.setGarageIds(List.of(99L));

        ResponseStatusException ex = assertThrows(ResponseStatusException.class, () -> service.create(req));
        assertTrue(ex.getReason() != null, "Expected an error reason");
    }

    // ── 4: create without garageIds (null) → no mapping rows saved ──────────

    @Test
    void createWithoutGarageIds_noMappingSaved() {
        CreateServicePackageRequest req = minimalRequest();
        req.setGarageIds(null);

        assertDoesNotThrow(() -> service.create(req));

        // No garage mapping should be saved when garageIds is null
        verify(garageServicePackageRepository, org.mockito.Mockito.never()).save(any());
    }

    // ── 5: getAvailable returns only packages mapped to garage ───────────────

    @Test
    void getAvailable_filtersToMappedPackagesOnly() {
        Garage garage5 = TestFixtures.garage();
        garage5.setId(5L);
        when(garageRepository.findById(5L)).thenReturn(Optional.of(garage5));
        ServicePackage pkg1 = minimalPackage(1L);
        ServicePackage pkg2 = minimalPackage(2L);
        when(servicePackageRepository.findByIsActiveTrue()).thenReturn(List.of(pkg1, pkg2));
        when(garageServicePackageRepository.findActivePackageIdsByGarageId(5L)).thenReturn(List.of(1L));

        List<ServicePackageResponse> result = service.getAvailable("CAR", 5L);

        assertTrue(result.stream().allMatch(r -> r.getId().equals(1L)),
                "Only package 1 should be returned for garage 5");
    }

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private static ServicePackage minimalPackage(Long id) {
        return ServicePackage.builder()
                .id(id).serviceType("MAIN").vehicleType("CAR")
                .basePrice(BigDecimal.valueOf(100_000)).durationMinutes(30)
                .washBayDurationMinutes(20).pointsEarned(0)
                .requiresWashBay(true).requiresCareStaff(false)
                .isActive(true).build();
    }

    private static CreateServicePackageRequest minimalRequest() {
        CreateServicePackageRequest r = new CreateServicePackageRequest();
        r.setName("Test Package");
        r.setCode("TEST-" + System.nanoTime());
        r.setVehicleType("CAR");
        r.setServiceType("MAIN");
        r.setBasePrice(BigDecimal.valueOf(100_000));
        r.setDurationMinutes(30);
        r.setWashBayDurationMinutes(20);
        r.setPointsEarned(0);
        r.setRequiresWashBay(true);
        r.setRequiresCareStaff(false);
        r.setSteps(List.of(new CreateServicePackageStepRequest(
                1, "Wash", "Wash desc", true, List.of(), "AUTOMATED_WASH", 20)));
        r.setIncludedServiceIds(List.of());
        return r;
    }
}
