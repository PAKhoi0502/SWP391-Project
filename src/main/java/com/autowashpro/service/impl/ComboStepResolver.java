package com.autowashpro.service.impl;

import com.autowashpro.entity.ServicePackage;
import com.autowashpro.entity.ServicePackageInclude;
import com.autowashpro.entity.ServicePackageStep;
import com.autowashpro.repository.ServicePackageIncludeRepository;
import com.autowashpro.repository.ServicePackageStepRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;

/**
 * Resolves the ordered list of processing steps for a service package.
 * MAIN/ADD_ON packages simply use their own steps. A COMBO package has no
 * steps of its own: its steps are derived from its included MAIN + ADD_ON
 * packages, with the add-on steps inserted right before the main package's
 * final step (handover) so the car is still handed over last.
 */
@Component
@RequiredArgsConstructor
public class ComboStepResolver {

    private final ServicePackageIncludeRepository includeRepository;
    private final ServicePackageStepRepository stepRepository;

    private static String normalizeType(String serviceType) {
        String value = serviceType == null ? "" : serviceType.trim().toUpperCase();
        return "ADDON".equals(value) ? "ADD_ON" : value;
    }

    public List<ServicePackageStep> resolveSteps(ServicePackage servicePackage) {
        if (!"COMBO".equals(normalizeType(servicePackage.getServiceType()))) {
            return stepRepository.findByServicePackage_IdOrderByStepOrder(servicePackage.getId());
        }

        List<ServicePackageInclude> includes =
                includeRepository.findByParentServicePackage_Id(servicePackage.getId());

        List<ServicePackageStep> mainSteps = new ArrayList<>();
        List<ServicePackageStep> addOnSteps = new ArrayList<>();

        for (ServicePackageInclude include : includes) {
            ServicePackage included = include.getIncludedServicePackage();
            List<ServicePackageStep> steps =
                    stepRepository.findByServicePackage_IdOrderByStepOrder(included.getId());

            if ("ADD_ON".equals(normalizeType(included.getServiceType()))) {
                addOnSteps.addAll(steps);
            } else {
                mainSteps.addAll(steps);
            }
        }

        List<ServicePackageStep> ordered = new ArrayList<>();
        if (!mainSteps.isEmpty()) {
            ordered.addAll(mainSteps.subList(0, mainSteps.size() - 1));
            ordered.addAll(addOnSteps);
            ordered.add(mainSteps.get(mainSteps.size() - 1));
        } else {
            ordered.addAll(addOnSteps);
        }

        return ordered;
    }
}
