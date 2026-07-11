package com.autowashpro.service.impl;

import com.autowashpro.entity.ServicePackage;
import com.autowashpro.entity.ServicePackageInclude;
import com.autowashpro.entity.ServicePackageStep;
import com.autowashpro.repository.ServicePackageIncludeRepository;
import com.autowashpro.repository.ServicePackageStepRepository;
import com.autowashpro.support.TestFixtures;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ComboStepResolverTest {

    @Mock
    private ServicePackageIncludeRepository includeRepository;

    @Mock
    private ServicePackageStepRepository stepRepository;

    @InjectMocks
    private ComboStepResolver resolver;

    @Test
    void mainPackageUsesItsOwnSteps() {
        ServicePackage main = TestFixtures.carWashPackage();
        ServicePackageStep step = step(1L, main, 1, "Wash");
        when(stepRepository.findByServicePackage_IdOrderByStepOrder(main.getId()))
                .thenReturn(List.of(step));

        List<ServicePackageStep> result = resolver.resolveSteps(main);

        assertEquals(List.of(step), result);
        verify(includeRepository, never()).findByParentServicePackage_Id(main.getId());
    }

    @Test
    void addOnPackageUsesItsOwnSteps() {
        ServicePackage addOn = TestFixtures.carWashPackage();
        addOn.setId(2L);
        addOn.setServiceType("ADD_ON");
        ServicePackageStep step = step(2L, addOn, 1, "Wax");
        when(stepRepository.findByServicePackage_IdOrderByStepOrder(addOn.getId()))
                .thenReturn(List.of(step));

        List<ServicePackageStep> result = resolver.resolveSteps(addOn);

        assertEquals(List.of(step), result);
    }

    @Test
    void comboCombinesMainStepsBeforeAddOnSteps() {
        ServicePackage combo = TestFixtures.carWashPackage();
        combo.setId(10L);
        combo.setServiceType("COMBO");
        ServicePackage main = TestFixtures.carWashPackage();
        main.setId(11L);
        ServicePackage addOn = TestFixtures.carWashPackage();
        addOn.setId(12L);
        addOn.setServiceType("ADD_ON");
        ServicePackageStep mainStep = step(1L, main, 1, "Wash");
        ServicePackageStep addOnStep = step(2L, addOn, 1, "Wax");
        ServicePackageInclude mainInclude = ServicePackageInclude.builder()
                .parentServicePackage(combo)
                .includedServicePackage(main)
                .sortOrder(1)
                .build();
        ServicePackageInclude addOnInclude = ServicePackageInclude.builder()
                .parentServicePackage(combo)
                .includedServicePackage(addOn)
                .sortOrder(2)
                .build();
        when(includeRepository.findByParentServicePackage_Id(combo.getId()))
                .thenReturn(List.of(mainInclude, addOnInclude));
        when(stepRepository.findByServicePackage_IdOrderByStepOrder(main.getId()))
                .thenReturn(List.of(mainStep));
        when(stepRepository.findByServicePackage_IdOrderByStepOrder(addOn.getId()))
                .thenReturn(List.of(addOnStep));

        List<ServicePackageStep> result = resolver.resolveSteps(combo);

        assertEquals(List.of(mainStep, addOnStep), result);
    }

    private ServicePackageStep step(Long id, ServicePackage servicePackage, int order, String name) {
        return ServicePackageStep.builder()
                .id(id)
                .servicePackage(servicePackage)
                .stepOrder(order)
                .name(name)
                .isRequired(true)
                .build();
    }
}
