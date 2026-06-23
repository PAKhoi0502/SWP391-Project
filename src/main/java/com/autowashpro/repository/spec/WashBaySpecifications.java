package com.autowashpro.repository.spec;

import com.autowashpro.entity.WashBay;
import com.autowashpro.entity.enums.WashBayStatus;
import org.springframework.data.jpa.domain.Specification;

public class WashBaySpecifications {

    public static Specification<WashBay> garageIdEquals(Long garageId) {
        return (root, query, cb) -> garageId == null ? null : cb.equal(root.get("garageId"), garageId);
    }

    public static Specification<WashBay> vehicleTypeEquals(String vehicleType) {
        return (root, query, cb) -> vehicleType == null ? null : cb.equal(root.get("vehicleType"), vehicleType);
    }

    public static Specification<WashBay> statusEquals(WashBayStatus status) {
        return (root, query, cb) -> status == null ? null : cb.equal(root.get("status"), status);
    }

    public static Specification<WashBay> isActiveEquals(Boolean isActive) {
        return (root, query, cb) -> isActive == null ? null : cb.equal(root.get("isActive"), isActive);
    }
}