package com.autowashpro.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "booking_assigned_staff")
@Getter
@Setter
public class BookingAssignedStaff {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "booking_id", nullable = false)
    private Long bookingId;

    @Column(name = "staff_profile_id", nullable = false)
    private Long staffProfileId;

    @Column(name = "assigned_from", nullable = false)
    private LocalDateTime assignedFrom;

    @Column(name = "assigned_to", nullable = false)
    private LocalDateTime assignedTo;

    @Column(name = "role_in_booking", length = 30)
    private String roleInBooking;

    @Column(name = "status", nullable = false, length = 30)
    private String status = "ASSIGNED";

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}