package com.autowashpro.repository;

import com.autowashpro.entity.Garage;
import org.springframework.data.jpa.repository.JpaRepository;

public interface GarageRepository extends JpaRepository<Garage, Long> {
}