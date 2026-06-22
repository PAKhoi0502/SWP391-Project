package com.autowashpro.repository.spec;

import com.autowashpro.entity.StaffProfile;
import com.autowashpro.entity.enums.StaffType;
import org.springframework.data.jpa.domain.Specification;

public class StaffProfileSpecifications {

    public static Specification<StaffProfile> garageIdEquals(Long garageId) {
        return (root, query, cb) -> garageId == null ? null : cb.equal(root.get("garageId"), garageId);
    }

    public static Specification<StaffProfile> staffTypeEquals(StaffType staffType) {
        return (root, query, cb) -> staffType == null ? null : cb.equal(root.get("staffType"), staffType);
    }

    public static Specification<StaffProfile> isActiveEquals(Boolean isActive) {
        return (root, query, cb) -> isActive == null ? null : cb.equal(root.get("isActive"), isActive);
    }
}