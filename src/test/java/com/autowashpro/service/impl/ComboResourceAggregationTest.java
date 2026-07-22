package com.autowashpro.service.impl;

import com.autowashpro.entity.ServicePackage;
import com.autowashpro.entity.ServicePackageInclude;
import com.autowashpro.repository.ServicePackageIncludeRepository;
import com.autowashpro.service.support.PackageResourceResolver;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * Tests that PackageResourceResolver correctly expands COMBO packages into their
 * constituent leaf packages so that resource window calculations capture care staff
 * requirements from child packages (fixing the COMBO resource aggregation bug).
 */
@ExtendWith(MockitoExtension.class)
class ComboResourceAggregationTest {

    @Mock
    private ServicePackageIncludeRepository includeRepository;

    @InjectMocks
    private PackageResourceResolver resolver;

    // ── helpers ────────────────────────────────────────────────────────────────

    private ServicePackage mainPkg(Long id) {
        return ServicePackage.builder()
                .id(id).serviceType("MAIN")
                .requiresWashBay(true).washBayDurationMinutes(30)
                .requiresCareStaff(false)
                .basePrice(BigDecimal.ZERO).durationMinutes(45)
                .washBayDurationMinutes(30).pointsEarned(0)
                .vehicleType("CAR").code("MAIN-" + id).name("Main " + id)
                .isActive(true).build();
    }

    private ServicePackage carePkg(Long id) {
        return ServicePackage.builder()
                .id(id).serviceType("ADD_ON")
                .requiresWashBay(false)
                .requiresCareStaff(true).careStaffType("VEHICLE_CARE_STAFF")
                .careStaffRequiredCount(1).careStaffDurationMinutes(45)
                .basePrice(BigDecimal.ZERO).durationMinutes(45)
                .washBayDurationMinutes(0).pointsEarned(0)
                .vehicleType("CAR").code("CARE-" + id).name("Care " + id)
                .isActive(true).build();
    }

    private ServicePackage comboPkg(Long id) {
        return ServicePackage.builder()
                .id(id).serviceType("COMBO")
                .requiresWashBay(false).requiresCareStaff(false)
                .basePrice(BigDecimal.ZERO).durationMinutes(90)
                .washBayDurationMinutes(0).pointsEarned(0)
                .vehicleType("CAR").code("COMBO-" + id).name("Combo " + id)
                .isActive(true).build();
    }

    private ServicePackageInclude include(ServicePackage parent, ServicePackage child, int order) {
        return ServicePackageInclude.builder()
                .id((long) order)
                .parentServicePackage(parent)
                .includedServicePackage(child)
                .sortOrder(order)
                .build();
    }

    // ── A: MAIN/ADD_ON are leaf packages ──────────────────────────────────────

    @Nested
    class LeafPackages {

        @Test
        void mainPackageReturnsSelf() {
            ServicePackage main = mainPkg(1L);

            List<ServicePackage> result = resolver.resolveEffectivePackages(main);

            assertEquals(List.of(main), result);
            verify(includeRepository, never()).findByParentServicePackage_Id(any());
        }

        @Test
        void addOnPackageReturnsSelf() {
            ServicePackage care = carePkg(2L);

            List<ServicePackage> result = resolver.resolveEffectivePackages(care);

            assertEquals(List.of(care), result);
            verify(includeRepository, never()).findByParentServicePackage_Id(any());
        }
    }

    // ── B: COMBO expansion ────────────────────────────────────────────────────

    @Nested
    class ComboExpansion {

        @Test
        void comboExpandsToChildren() {
            ServicePackage combo = comboPkg(10L);
            ServicePackage main = mainPkg(11L);
            ServicePackage care = carePkg(12L);
            when(includeRepository.findByParentServicePackage_Id(10L))
                    .thenReturn(List.of(include(combo, main, 1), include(combo, care, 2)));

            List<ServicePackage> result = resolver.resolveEffectivePackages(combo);

            assertEquals(2, result.size());
            assertTrue(result.contains(main));
            assertTrue(result.contains(care));
            // COMBO itself is not in result
            assertFalse(result.contains(combo));
        }

        @Test
        void comboPreservesChildSortOrder() {
            ServicePackage combo = comboPkg(10L);
            ServicePackage main = mainPkg(11L);
            ServicePackage care = carePkg(12L);
            // care has lower sort order than main — should appear first
            when(includeRepository.findByParentServicePackage_Id(10L))
                    .thenReturn(List.of(include(combo, care, 1), include(combo, main, 2)));

            List<ServicePackage> result = resolver.resolveEffectivePackages(combo);

            assertEquals(care, result.get(0));
            assertEquals(main, result.get(1));
        }

        @Test
        void nestedComboIsFullyExpanded() {
            ServicePackage outer = comboPkg(10L);
            ServicePackage inner = comboPkg(20L);
            ServicePackage main = mainPkg(11L);
            ServicePackage care = carePkg(12L);
            when(includeRepository.findByParentServicePackage_Id(10L))
                    .thenReturn(List.of(include(outer, inner, 1)));
            when(includeRepository.findByParentServicePackage_Id(20L))
                    .thenReturn(List.of(include(inner, main, 1), include(inner, care, 2)));

            List<ServicePackage> result = resolver.resolveEffectivePackages(outer);

            assertEquals(2, result.size());
            assertTrue(result.contains(main));
            assertTrue(result.contains(care));
        }

        @Test
        void cycleDoesNotCauseInfiniteLoop() {
            ServicePackage combo = comboPkg(10L);
            // Self-referencing include (degenerate data)
            when(includeRepository.findByParentServicePackage_Id(10L))
                    .thenReturn(List.of(include(combo, combo, 1)));

            // Must not throw StackOverflowError
            List<ServicePackage> result = assertDoesNotThrow(() ->
                    resolver.resolveEffectivePackages(combo));
            // No leaf packages added (combo was already visited)
            assertTrue(result.isEmpty());
        }

        @Test
        void deduplicatesCrossReferencedPackages() {
            // Two COMBOs share a common included child
            ServicePackage outer = comboPkg(10L);
            ServicePackage inner1 = comboPkg(20L);
            ServicePackage inner2 = comboPkg(30L);
            ServicePackage shared = mainPkg(99L);
            when(includeRepository.findByParentServicePackage_Id(10L))
                    .thenReturn(List.of(include(outer, inner1, 1), include(outer, inner2, 2)));
            when(includeRepository.findByParentServicePackage_Id(20L))
                    .thenReturn(List.of(include(inner1, shared, 1)));
            when(includeRepository.findByParentServicePackage_Id(30L))
                    .thenReturn(List.of(include(inner2, shared, 1)));

            List<ServicePackage> result = resolver.resolveEffectivePackages(outer);

            // shared appears only once
            assertEquals(1, result.size());
            assertEquals(shared, result.get(0));
        }
    }

    // ── C: Resource window correctness for COMBO with care child ─────────────

    @Nested
    class ResourceWindowIntegration {

        /**
         * Core regression: a COMBO whose child ADD_ON requiresCareStaff=true must
         * have requiresCareStaff resolved as true when the resolver is used to build
         * the effective package list.
         */
        @Test
        void comboWithCareChildSurfacesCareRequirement() {
            ServicePackage combo = comboPkg(10L);
            ServicePackage washPkg = mainPkg(11L);     // requiresWashBay=true, requiresCareStaff=false
            ServicePackage carePkg = carePkg(12L);     // requiresCareStaff=true

            when(includeRepository.findByParentServicePackage_Id(10L))
                    .thenReturn(List.of(include(combo, washPkg, 1), include(combo, carePkg, 2)));

            List<ServicePackage> effective = resolver.resolveEffectivePackages(combo);

            // requiresCareStaff is the OR of all effective packages
            boolean anyRequiresCare = effective.stream()
                    .anyMatch(p -> Boolean.TRUE.equals(p.getRequiresCareStaff()));
            assertTrue(anyRequiresCare,
                    "COMBO with care child must surface requiresCareStaff=true");

            // requiresWashBay is also preserved
            boolean anyRequiresWash = effective.stream()
                    .anyMatch(p -> Boolean.TRUE.equals(p.getRequiresWashBay()));
            assertTrue(anyRequiresWash,
                    "COMBO with wash child must surface requiresWashBay=true");
        }

        @Test
        void comboCareMinutesAreAggregated() {
            ServicePackage combo = comboPkg(10L);
            ServicePackage washPkg = mainPkg(11L);
            ServicePackage carePkg1 = carePkg(12L);   // careStaffDurationMinutes = 45
            ServicePackage carePkg2 = carePkg(13L);
            carePkg2.setId(13L);
            carePkg2.setCareStaffDurationMinutes(30);

            when(includeRepository.findByParentServicePackage_Id(10L))
                    .thenReturn(List.of(
                            include(combo, washPkg, 1),
                            include(combo, carePkg1, 2),
                            include(combo, carePkg2, 3)));

            List<ServicePackage> effective = resolver.resolveEffectivePackages(combo);

            int totalCare = effective.stream()
                    .filter(p -> Boolean.TRUE.equals(p.getRequiresCareStaff()))
                    .mapToInt(p -> p.getCareStaffDurationMinutes() != null ? p.getCareStaffDurationMinutes() : 0)
                    .sum();
            assertEquals(75, totalCare,
                    "Total care minutes should be sum of all care child packages (45 + 30 = 75)");
        }

        @Test
        void pureWashComboHasNoCareRequirement() {
            ServicePackage combo = comboPkg(10L);
            ServicePackage washPkg1 = mainPkg(11L);
            ServicePackage washPkg2 = mainPkg(12L);
            washPkg2.setId(12L);
            washPkg2.setRequiresCareStaff(false);

            when(includeRepository.findByParentServicePackage_Id(10L))
                    .thenReturn(List.of(include(combo, washPkg1, 1), include(combo, washPkg2, 2)));

            List<ServicePackage> effective = resolver.resolveEffectivePackages(combo);

            boolean anyRequiresCare = effective.stream()
                    .anyMatch(p -> Boolean.TRUE.equals(p.getRequiresCareStaff()));
            assertFalse(anyRequiresCare,
                    "COMBO with only wash children must NOT surface requiresCareStaff");
        }
    }
}
