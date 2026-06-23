package com.autowashpro.repository.spec;

import com.autowashpro.entity.Vehicle;
import org.springframework.data.jpa.domain.Specification;

public class VehicleSpecifications {

    public static Specification<Vehicle> vehicleTypeEquals(String vehicleType) {
        return (root, query, cb) -> vehicleType == null ? null
                : cb.equal(root.get("vehicleType"), vehicleType);
    }

    public static Specification<Vehicle> keywordContains(String keyword) {
        return (root, query, cb) -> {
            if (keyword == null || keyword.isBlank()) return null;
            String pattern = "%" + keyword.toLowerCase() + "%";
            return cb.or(
                cb.like(cb.lower(root.get("normalizedLicensePlate")), pattern),
                cb.like(cb.lower(root.get("brand")), pattern),
                cb.like(cb.lower(root.get("model")), pattern)
            );
        };
    }
}