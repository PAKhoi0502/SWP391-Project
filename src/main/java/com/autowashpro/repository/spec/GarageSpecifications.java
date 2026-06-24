package com.autowashpro.repository.spec;

import com.autowashpro.entity.Garage;
import org.springframework.data.jpa.domain.Specification;

public class GarageSpecifications {

    public static Specification<Garage> isActiveEquals(Boolean isActive) {
        return (root, query, cb) -> isActive == null ? null : cb.equal(root.get("isActive"), isActive);
    }

    public static Specification<Garage> keywordContains(String keyword) {
        return (root, query, cb) -> {
            if (keyword == null || keyword.isBlank()) return null;
            String pattern = "%" + keyword.toLowerCase() + "%";
            return cb.or(
                cb.like(cb.lower(root.get("name")), pattern),
                cb.like(cb.lower(root.get("address")), pattern),
                cb.like(cb.lower(root.get("city")), pattern)
            );
        };
    }
}