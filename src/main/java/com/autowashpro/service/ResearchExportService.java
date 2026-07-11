package com.autowashpro.service;

import com.autowashpro.dto.request.ResearchExportFilterRequest;
import com.autowashpro.dto.response.ResearchExportFile;

public interface ResearchExportService {
    ResearchExportFile exportBookings(ResearchExportFilterRequest filter);

    ResearchExportFile exportCustomers(ResearchExportFilterRequest filter);
}
