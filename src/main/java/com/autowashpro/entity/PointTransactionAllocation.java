package com.autowashpro.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.PrePersist;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.time.LocalDateTime;

@Entity
@Table(
    name = "point_transaction_allocations",
    indexes = {
        @Index(name = "IX_pta_debit",  columnList = "debit_transaction_id"),
        @Index(name = "IX_pta_credit", columnList = "credit_transaction_id")
    },
    uniqueConstraints = @UniqueConstraint(
        name = "UQ_pta_debit_credit",
        columnNames = {"debit_transaction_id", "credit_transaction_id"}
    )
)
@Getter
@Setter
@NoArgsConstructor
public class PointTransactionAllocation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "debit_transaction_id", nullable = false)
    private Long debitTransactionId;

    @Column(name = "credit_transaction_id", nullable = false)
    private Long creditTransactionId;

    @Column(name = "allocated_points", nullable = false)
    private Integer allocatedPoints;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = LocalDateTime.now();
    }
}
