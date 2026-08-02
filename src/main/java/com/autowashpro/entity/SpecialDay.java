package com.autowashpro.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "special_days")
@Getter
@Setter
public class SpecialDay {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "day_name", nullable = false, length = 100)
    private String dayName;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "end_date", nullable = false)
    private LocalDate endDate;

    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;

    // Whole-number percentage (e.g. 30.00 = 30%), applied to a booking's original price
    // when its date falls inside this special day's range.
    @Column(name = "surcharge_rate", nullable = false, precision = 5, scale = 2)
    private BigDecimal surchargeRate = BigDecimal.valueOf(30);
}
