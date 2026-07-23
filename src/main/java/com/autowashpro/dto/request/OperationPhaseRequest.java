package com.autowashpro.dto.request;

import lombok.Data;

/** Generic request body for operation-phase transition endpoints. */
@Data
public class OperationPhaseRequest {
    private String note;
    private Long washBayId; // optional: allow staff to pick a specific bay
}
