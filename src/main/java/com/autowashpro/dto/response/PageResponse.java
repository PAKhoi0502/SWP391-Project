package com.autowashpro.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
@AllArgsConstructor
public class PageResponse<T> {
    private List<T> data;
    private int page;
    private int limit;
    private long totalItems;
    private int totalPages;
}