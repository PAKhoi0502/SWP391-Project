package com.autowashpro.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "deposit_refunds")
@Getter
@Setter
public class DepositRefund {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "booking_id", nullable = false)
    private Long bookingId;

    @Column(name = "customer_id", nullable = false)
    private Long customerId;

    @Column(name = "bank_account_id", nullable = false)
    private Long bankAccountId;

    @Column(name = "bank_name", nullable = false, length = 150)
    private String bankName;

    @Column(name = "account_number", nullable = false, length = 50)
    private String accountNumber;

    @Column(name = "account_holder_name", nullable = false, length = 150)
    private String accountHolderName;

    @Column(name = "requested_amount", nullable = false)
    private BigDecimal requestedAmount;

    @Column(name = "status", nullable = false, length = 20)
    private String status = "REQUESTED";

    @Column(name = "reject_reason", length = 500)
    private String rejectReason;

    @Column(name = "admin_note", length = 500)
    private String adminNote;

    @Column(name = "transaction_reference", length = 100)
    private String transactionReference;

    @Column(name = "requested_at", nullable = false)
    private LocalDateTime requestedAt;

    @Column(name = "reviewed_by")
    private Long reviewedBy;

    @Column(name = "reviewed_at")
    private LocalDateTime reviewedAt;

    @Column(name = "executed_by")
    private Long executedBy;

    @Column(name = "executed_at")
    private LocalDateTime executedAt;

    @CreationTimestamp
    @Column(name = "created_at", updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at")
    private LocalDateTime updatedAt;
}
