package com.autowashpro.service.support;

import com.autowashpro.entity.ServicePackage;
import com.autowashpro.entity.ServicePackageInclude;
import com.autowashpro.repository.ServicePackageIncludeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

/**
 * Resolves the effective set of leaf packages whose resource flags (requiresWashBay,
 * requiresCareStaff, washBayDurationMinutes, careStaffDurationMinutes, etc.) contribute
 * to resource window calculation for a booking.
 *
 * <ul>
 *   <li>MAIN / ADD_ON → returns [pkg] itself.</li>
 *   <li>COMBO → recursively expands all ServicePackageInclude children; COMBO nodes are
 *       excluded from the result because they carry no resources of their own.</li>
 * </ul>
 *
 * Cycle-safe via a visited-ID set.  Stable ordering: children are processed in ascending
 * sortOrder within each COMBO level.  Deduplication is preserved across nested COMBOs.
 */
@Component
@RequiredArgsConstructor
public class PackageResourceResolver {

    private final ServicePackageIncludeRepository includeRepository;

    /**
     * Returns the flat, deduplicated list of non-COMBO packages that provide the
     * actual resource requirements for {@code pkg}.
     */
    public List<ServicePackage> resolveEffectivePackages(ServicePackage pkg) {
        List<ServicePackage> result = new ArrayList<>();
        expand(pkg, new LinkedHashSet<>(), result);
        return result;
    }

    private void expand(ServicePackage pkg, Set<Long> visited, List<ServicePackage> result) {
        if (pkg == null || !visited.add(pkg.getId())) {
            return;
        }

        if ("COMBO".equals(normalizeType(pkg.getServiceType()))) {
            List<ServicePackageInclude> includes = new ArrayList<>(
                    includeRepository.findByParentServicePackage_Id(pkg.getId()));
            includes.sort(Comparator.comparing(i -> Objects.requireNonNullElse(i.getSortOrder(), 0)));
            for (ServicePackageInclude inc : includes) {
                expand(inc.getIncludedServicePackage(), visited, result);
            }
        } else {
            result.add(pkg);
        }
    }

    private static String normalizeType(String t) {
        if (t == null) return "";
        String v = t.trim().toUpperCase();
        return "ADDON".equals(v) ? "ADD_ON" : v;
    }
}
