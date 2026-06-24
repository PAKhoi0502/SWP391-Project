package com.autowashpro.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

@Entity
@Table(name = "wash_bays")
@Getter
@Setter
public class WashBay {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "garage_id", nullable = false)
    private Long garageId;

    @Column(name = "bay_code", nullable = false, length = 50)
    private String bayCode;

    @Column(name = "vehicle_type", nullable = false, length = 30)
    private String vehicleType;

    @Column(name = "status", nullable = false, length = 30)
    private String status;

    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;
}