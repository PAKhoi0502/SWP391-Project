package com.autowashpro.entity.enums;

public enum WashBayStatus {
    AVAILABLE,
    IN_USE,       // spec gọi là OCCUPIED, DB seed dùng IN_USE
    MAINTENANCE,
    INACTIVE
}