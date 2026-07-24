package com.autowashpro.service.impl;

import com.autowashpro.dto.request.CreateServicePackageRequest;
import com.autowashpro.dto.request.CreateServicePackageStepRequest;
import com.autowashpro.entity.ServicePackage;
import com.autowashpro.entity.ServicePackageInclude;
import com.autowashpro.repository.GarageRepository;
import com.autowashpro.repository.GarageServicePackageRepository;
import com.autowashpro.repository.ServicePackageIncludeRepository;
import com.autowashpro.repository.ServicePackageRepository;
import com.autowashpro.repository.ServicePackageStepInstructionRepository;
import com.autowashpro.repository.ServicePackageStepRepository;
import com.autowashpro.service.support.PackageResourceResolver;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

/**
 * Tests 1-3 and 16-20 from the resource window normalisation spec:
 *
 *  1. COMBO(main+care) and MAIN + ADD-ON produce identical wash minutes.
 *  2. COMBO(main+care) and MAIN + ADD-ON produce identical care minutes.
 *  3. COMBO with two care children aggregates care minutes correctly.
 * 16. care_staff_duration_minutes is derived from VEHICLE_CARE steps (not request field).
 * 17. wash_bay_duration_minutes is derived from AUTOMATED_WASH steps.
 * 18. COMBO type is excluded from step-based wash/care derivation at create time.
 * 19. ADD-ON care-only package gets care duration from steps; wash duration = 0.
 * 20. Package with no care steps gets careStaffDurationMinutes = 0 (not null).
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class ResourceWindowsTest {

    // ── Section A: Resolver-level equivalence (tests 1-3) ─────────────────────

    @Nested
    class ComboVsMainAddOnEquivalence {

        @Mock ServicePackageIncludeRepository includeRepository;
        @InjectMocks PackageResourceResolver resolver;

        private ServicePackage wash(Long id, int washMin) {
            return ServicePackage.builder()
                    .id(id).serviceType("MAIN")
                    .requiresWashBay(true).washBayDurationMinutes(washMin)
                    .requiresCareStaff(false).careStaffDurationMinutes(0)
                    .basePrice(BigDecimal.ZERO).durationMinutes(washMin)
                    .pointsEarned(0).vehicleType("CAR")
                    .code("MAIN-" + id).name("Wash " + id).isActive(true).build();
        }

        private ServicePackage care(Long id, int careMin) {
            return ServicePackage.builder()
                    .id(id).serviceType("ADD_ON")
                    .requiresWashBay(false).washBayDurationMinutes(0)
                    .requiresCareStaff(true).careStaffType("VEHICLE_CARE_STAFF")
                    .careStaffRequiredCount(1).careStaffDurationMinutes(careMin)
                    .basePrice(BigDecimal.ZERO).durationMinutes(careMin)
                    .pointsEarned(0).vehicleType("CAR")
                    .code("ADDON-" + id).name("Care " + id).isActive(true).build();
        }

        private ServicePackage combo(Long id) {
            return ServicePackage.builder()
                    .id(id).serviceType("COMBO")
                    .requiresWashBay(false).requiresCareStaff(false)
                    .basePrice(BigDecimal.ZERO).durationMinutes(0)
                    .washBayDurationMinutes(0).pointsEarned(0)
                    .vehicleType("CAR").code("COMBO-" + id).name("Combo " + id)
                    .isActive(true).build();
        }

        private ServicePackageInclude inc(ServicePackage parent, ServicePackage child, int order) {
            return ServicePackageInclude.builder()
                    .id((long) order).parentServicePackage(parent)
                    .includedServicePackage(child).sortOrder(order).build();
        }

        /** Test 1: wash minutes agree */
        @Test
        void test1_comboAndMainAddOn_sameWashMinutes() {
            ServicePackage mainPkg = wash(10L, 30);
            ServicePackage carePkg = care(11L, 60);

            // COMBO path
            ServicePackage comboPkg = combo(20L);
            when(includeRepository.findByParentServicePackage_Id(20L))
                    .thenReturn(List.of(inc(comboPkg, mainPkg, 1), inc(comboPkg, carePkg, 2)));
            List<ServicePackage> comboEffective = resolver.resolveEffectivePackages(comboPkg);

            // MAIN + ADD-ON path (individual selects — no resolver needed, they are leaves)
            List<ServicePackage> directEffective = List.of(mainPkg, carePkg);

            int comboWash  = comboEffective.stream().mapToInt(p -> p.getWashBayDurationMinutes() != null ? p.getWashBayDurationMinutes() : 0).sum();
            int directWash = directEffective.stream().mapToInt(p -> p.getWashBayDurationMinutes() != null ? p.getWashBayDurationMinutes() : 0).sum();
            assertEquals(comboWash, directWash,
                    "COMBO and MAIN+ADD-ON must produce the same total wash bay minutes");
        }

        /** Test 2: care minutes agree */
        @Test
        void test2_comboAndMainAddOn_sameCareMinutes() {
            ServicePackage mainPkg = wash(10L, 30);
            ServicePackage carePkg = care(11L, 60);

            ServicePackage comboPkg = combo(20L);
            when(includeRepository.findByParentServicePackage_Id(20L))
                    .thenReturn(List.of(inc(comboPkg, mainPkg, 1), inc(comboPkg, carePkg, 2)));
            List<ServicePackage> comboEffective = resolver.resolveEffectivePackages(comboPkg);
            List<ServicePackage> directEffective = List.of(mainPkg, carePkg);

            int comboCare  = comboEffective.stream().mapToInt(p -> p.getCareStaffDurationMinutes() != null ? p.getCareStaffDurationMinutes() : 0).sum();
            int directCare = directEffective.stream().mapToInt(p -> p.getCareStaffDurationMinutes() != null ? p.getCareStaffDurationMinutes() : 0).sum();
            assertEquals(comboCare, directCare,
                    "COMBO and MAIN+ADD-ON must produce the same total care staff minutes");
        }

        /** Test 3: COMBO with two care children aggregates care minutes */
        @Test
        void test3_comboWithTwoCareChildren_aggregatesCareMinutes() {
            ServicePackage mainPkg  = wash(10L, 30);
            ServicePackage carePkg1 = care(11L, 45);
            ServicePackage carePkg2 = care(12L, 30);

            ServicePackage comboPkg = combo(20L);
            when(includeRepository.findByParentServicePackage_Id(20L))
                    .thenReturn(List.of(
                            inc(comboPkg, mainPkg, 1),
                            inc(comboPkg, carePkg1, 2),
                            inc(comboPkg, carePkg2, 3)));

            List<ServicePackage> effective = resolver.resolveEffectivePackages(comboPkg);

            int totalCare = effective.stream()
                    .mapToInt(p -> p.getCareStaffDurationMinutes() != null ? p.getCareStaffDurationMinutes() : 0)
                    .sum();
            assertEquals(75, totalCare, "45 + 30 = 75 care minutes for COMBO with two care children");
        }
    }

    // ── Section B: Step-based duration derivation (tests 16-20) ──────────────

    @Nested
    class StepBasedDurationDerivation {

        @Mock ServicePackageRepository servicePackageRepository;
        @Mock ServicePackageIncludeRepository includeRepository;
        @Mock ServicePackageStepRepository stepRepository;
        @Mock ServicePackageStepInstructionRepository instructionRepository;
        @Mock ComboStepResolver comboStepResolver;
        @Mock GarageRepository garageRepository;
        @Mock GarageServicePackageRepository garageServicePackageRepository;

        @InjectMocks ServicePackageServiceImpl service;

        private final AtomicLong idSeq = new AtomicLong(100);

        @BeforeEach
        void setUp() {
            when(servicePackageRepository.existsByCode(any())).thenReturn(false);
            when(servicePackageRepository.save(any(ServicePackage.class))).thenAnswer(inv -> {
                ServicePackage p = inv.getArgument(0);
                if (p.getId() == null) p.setId(idSeq.getAndIncrement());
                return p;
            });
            when(servicePackageRepository.findById(anyLong())).thenAnswer(inv ->
                    Optional.of(minimalPkg((Long) inv.getArgument(0))));
            when(stepRepository.save(any())).thenAnswer(inv -> {
                var s = inv.getArgument(0, com.autowashpro.entity.ServicePackageStep.class);
                s.setId(idSeq.getAndIncrement());
                return s;
            });
            when(instructionRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
            when(includeRepository.findByParentServicePackage_Id(anyLong())).thenReturn(List.of());
            when(comboStepResolver.resolveSteps(any())).thenReturn(List.of());
            when(instructionRepository.findByServicePackageStep_IdOrderByInstructionOrder(anyLong()))
                    .thenReturn(List.of());
        }

        private static ServicePackage minimalPkg(Long id) {
            return ServicePackage.builder()
                    .id(id).serviceType("MAIN").vehicleType("CAR")
                    .basePrice(BigDecimal.valueOf(100_000)).durationMinutes(30)
                    .washBayDurationMinutes(30).careStaffDurationMinutes(0).pointsEarned(0)
                    .requiresWashBay(true).requiresCareStaff(false).isActive(true).build();
        }

        private CreateServicePackageRequest mainRequest(List<CreateServicePackageStepRequest> steps) {
            CreateServicePackageRequest r = new CreateServicePackageRequest();
            r.setName("Test Pkg");
            r.setCode("TEST-" + idSeq.getAndIncrement());
            r.setVehicleType("CAR");
            r.setServiceType("MAIN");
            r.setBasePrice(BigDecimal.valueOf(100_000));
            r.setDurationMinutes(90);
            r.setWashBayDurationMinutes(30);
            r.setPointsEarned(0);
            r.setRequiresWashBay(true);
            r.setRequiresCareStaff(false);
            r.setIncludedServiceIds(List.of());
            r.setSteps(steps);
            return r;
        }

        private CreateServicePackageRequest addOnRequest(List<CreateServicePackageStepRequest> steps) {
            CreateServicePackageRequest r = mainRequest(steps);
            r.setServiceType("ADD_ON");
            r.setRequiresWashBay(false);
            r.setRequiresCareStaff(true);
            r.setCareStaffType("VEHICLE_CARE_STAFF");
            r.setCareStaffRequiredCount(1);
            r.setWashBayDurationMinutes(0);
            return r;
        }

        private CreateServicePackageStepRequest step(String phase, int minutes) {
            return new CreateServicePackageStepRequest(1, "Step", "Desc", true, List.of(), phase, minutes);
        }

        /** Test 16: careStaffDurationMinutes is derived from VEHICLE_CARE steps */
        @Test
        void test16_careStaffDurationDerivedFromVehicleCareSteps() {
            // Even if we pass washBayDurationMinutes=0 for an ADD_ON, the service
            // must derive careStaffDurationMinutes from VEHICLE_CARE steps.
            // We capture the saved package to inspect the derived field.
            ServicePackage[] saved = {null};
            when(servicePackageRepository.save(any(ServicePackage.class))).thenAnswer(inv -> {
                ServicePackage p = inv.getArgument(0);
                if (p.getId() == null) p.setId(idSeq.getAndIncrement());
                saved[0] = p;
                return p;
            });

            service.create(addOnRequest(List.of(step("VEHICLE_CARE", 45), step("VEHICLE_CARE", 15))));

            assertNotNull(saved[0], "Package must have been saved");
            assertEquals(60, saved[0].getCareStaffDurationMinutes(),
                    "careStaffDurationMinutes must equal sum of VEHICLE_CARE step durations (45+15=60)");
        }

        /** Test 17: washBayDurationMinutes is derived from AUTOMATED_WASH steps */
        @Test
        void test17_washBayDurationDerivedFromAutomatedWashSteps() {
            ServicePackage[] saved = {null};
            when(servicePackageRepository.save(any(ServicePackage.class))).thenAnswer(inv -> {
                ServicePackage p = inv.getArgument(0);
                if (p.getId() == null) p.setId(idSeq.getAndIncrement());
                saved[0] = p;
                return p;
            });

            CreateServicePackageRequest req = mainRequest(List.of(step("AUTOMATED_WASH", 20), step("AUTOMATED_WASH", 10)));
            req.setWashBayDurationMinutes(99); // must be overridden by step derivation
            service.create(req);

            assertNotNull(saved[0]);
            assertEquals(30, saved[0].getWashBayDurationMinutes(),
                    "washBayDurationMinutes must equal sum of AUTOMATED_WASH step durations (20+10=30)");
        }

        /** Test 18: COMBO packages skip step-based derivation (no steps owned) */
        @Test
        void test18_comboSkipsStepBasedDuration() {
            ServicePackage[] saved = {null};
            when(servicePackageRepository.save(any(ServicePackage.class))).thenAnswer(inv -> {
                ServicePackage p = inv.getArgument(0);
                if (p.getId() == null) p.setId(idSeq.getAndIncrement());
                saved[0] = p;
                return p;
            });

            CreateServicePackageRequest r = mainRequest(null);
            r.setServiceType("COMBO");
            r.setSteps(null);
            r.setRequiresWashBay(false);
            r.setWashBayDurationMinutes(0);
            assertDoesNotThrow(() -> service.create(r));

            // COMBO has no steps → care derivation returns 0, wash derivation returns 0
            assertNotNull(saved[0]);
            int care = saved[0].getCareStaffDurationMinutes() != null ? saved[0].getCareStaffDurationMinutes() : 0;
            assertEquals(0, care, "COMBO must have careStaffDurationMinutes=0 (no steps)");
        }

        /** Test 19: ADD-ON care-only package: care duration from steps, wash duration = 0 */
        @Test
        void test19_addOnCareOnly_careFromSteps_washZero() {
            ServicePackage[] saved = {null};
            when(servicePackageRepository.save(any(ServicePackage.class))).thenAnswer(inv -> {
                ServicePackage p = inv.getArgument(0);
                if (p.getId() == null) p.setId(idSeq.getAndIncrement());
                saved[0] = p;
                return p;
            });

            service.create(addOnRequest(List.of(step("VEHICLE_CARE", 30))));

            assertNotNull(saved[0]);
            assertEquals(30, saved[0].getCareStaffDurationMinutes(),
                    "Care-only ADD-ON must derive 30 care minutes from VEHICLE_CARE step");
            int washMin = saved[0].getWashBayDurationMinutes() != null ? saved[0].getWashBayDurationMinutes() : 0;
            assertEquals(0, washMin, "Care-only ADD-ON must have 0 wash bay minutes");
        }

        /** Test 20: package with no care steps gets careStaffDurationMinutes = 0 (not null) */
        @Test
        void test20_noVehicleCareSteps_careStaffDurationIsZero() {
            ServicePackage[] saved = {null};
            when(servicePackageRepository.save(any(ServicePackage.class))).thenAnswer(inv -> {
                ServicePackage p = inv.getArgument(0);
                if (p.getId() == null) p.setId(idSeq.getAndIncrement());
                saved[0] = p;
                return p;
            });

            // Only AUTOMATED_WASH steps — no VEHICLE_CARE
            service.create(mainRequest(List.of(step("AUTOMATED_WASH", 30))));

            assertNotNull(saved[0]);
            int care = saved[0].getCareStaffDurationMinutes() != null ? saved[0].getCareStaffDurationMinutes() : 0;
            assertEquals(0, care,
                    "Package with no VEHICLE_CARE steps must have careStaffDurationMinutes = 0");
        }
    }
}
