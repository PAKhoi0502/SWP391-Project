package com.autowashpro.entity;

import com.autowashpro.entity.enums.StaffType;
import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "staff_profiles")
@Getter
@Setter
public class StaffProfile {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false, unique = true)
    private User user;

    @Column(name = "garage_id", nullable = false)
    private Long garageId;

    @Column(name = "staff_code", nullable = false, unique = true, length = 50)
    private String staffCode;

    @Enumerated(EnumType.STRING)
    @Column(name = "staff_type", nullable = false, length = 30)
    private StaffType staffType;

    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}