package com.autowashpro.repository;

import com.autowashpro.entity.Garage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface GarageRepository
        extends JpaRepository<Garage, Long>, JpaSpecificationExecutor<Garage> {

    boolean existsByGarageCode(String garageCode);
    boolean existsByPhone(String phone);
}