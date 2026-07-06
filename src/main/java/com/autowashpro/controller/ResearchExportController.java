package com.autowashpro.controller;

import com.autowashpro.dto.request.ResearchExportFilterRequest;
import com.autowashpro.dto.response.ResearchExportFile;
import com.autowashpro.service.ResearchExportService;
import lombok.RequiredArgsConstructor;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.time.LocalDate;

@RestController
@RequestMapping("/admin/research")
@RequiredArgsConstructor
@PreAuthorize("hasRole('ADMIN')")
public class ResearchExportController {

    private final ResearchExportService researchExportService;

    @GetMapping("/bookings/export")
    public ResponseEntity<byte[]> exportBookings(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String format) {
        return response(researchExportService.exportBookings(filter(from, to, format)));
    }

    @GetMapping("/customers/export")
    public ResponseEntity<byte[]> exportCustomers(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate from,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate to,
            @RequestParam(required = false) String format) {
        return response(researchExportService.exportCustomers(filter(from, to, format)));
    }

    private ResearchExportFilterRequest filter(LocalDate from, LocalDate to, String format) {
        return ResearchExportFilterRequest.builder()
                .from(from)
                .to(to)
                .format(format)
                .build();
    }

    private ResponseEntity<byte[]> response(ResearchExportFile file) {
        String disposition = ContentDisposition.attachment()
                .filename(file.filename(), StandardCharsets.UTF_8)
                .build()
                .toString();
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(file.contentType()))
                .header(HttpHeaders.CONTENT_DISPOSITION, disposition)
                .cacheControl(CacheControl.noStore())
                .header(HttpHeaders.PRAGMA, "no-cache")
                .body(file.content());
    }
}
