package com.autowashpro.service;

import com.autowashpro.dto.request.BookingExceptionReportCreateRequest;
import com.autowashpro.dto.request.UpdateExceptionReportStatusRequest;
import com.autowashpro.dto.response.BookingExceptionReportResponse;
import org.springframework.data.domain.Page;

import java.util.List;

public interface BookingExceptionReportService {

    BookingExceptionReportResponse createReport(Long bookingId, Long customerId, BookingExceptionReportCreateRequest request);

    List<BookingExceptionReportResponse> getMyReports(Long customerId);

    Page<BookingExceptionReportResponse> getAdminReports(int page, int limit, String status, String category);

    BookingExceptionReportResponse getAdminReportDetail(Long reportId);

    BookingExceptionReportResponse updateStatus(Long reportId, UpdateExceptionReportStatusRequest request);
}
