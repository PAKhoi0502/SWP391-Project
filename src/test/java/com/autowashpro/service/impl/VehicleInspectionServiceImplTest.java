package com.autowashpro.service.impl;

import com.autowashpro.dto.request.VehicleInspectionCreateRequest;
import com.autowashpro.dto.response.VehicleInspectionResponse;
import com.autowashpro.entity.Booking;
import com.autowashpro.entity.Upload;
import com.autowashpro.entity.VehicleInspection;
import com.autowashpro.entity.VehicleInspectionImage;
import com.autowashpro.repository.BookingRepository;
import com.autowashpro.repository.BookingServiceStepRepository;
import com.autowashpro.repository.GarageRepository;
import com.autowashpro.repository.UserRepository;
import com.autowashpro.repository.VehicleInspectionImageRepository;
import com.autowashpro.repository.VehicleInspectionRepository;
import com.autowashpro.repository.VehicleRepository;
import com.autowashpro.service.UploadService;
import com.autowashpro.service.support.InspectionAccessPolicy;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.doNothing;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class VehicleInspectionServiceImplTest {

    @Mock
    private VehicleInspectionRepository inspectionRepository;

    @Mock
    private VehicleInspectionImageRepository imageRepository;

    @Mock
    private BookingRepository bookingRepository;

    @Mock
    private VehicleRepository vehicleRepository;

    @Mock
    private GarageRepository garageRepository;

    @Mock
    private UserRepository userRepository;

    @Mock
    private UploadService uploadService;

    @Mock
    private BookingServiceStepRepository bookingServiceStepRepository;

    @Mock
    private InspectionAccessPolicy inspectionAccessPolicy;

    @InjectMocks
    private VehicleInspectionServiceImpl inspectionService;

    @Test
    void createsInspectionFromManagedPublicIdsForAdmin() {
        Booking booking = new Booking();
        booking.setId(30L);
        booking.setGarageId(10L);
        booking.setVehicleId(20L);
        Upload upload = new Upload();
        upload.setFileUrl("https://images.test/inspection.jpg");
        upload.setPublicId("autowashpro/inspections/inspection-1");
        VehicleInspectionCreateRequest request = new VehicleInspectionCreateRequest();
        request.setInspectionType("BEFORE_WASH");
        request.setImagePublicIds(List.of(upload.getPublicId()));

        when(bookingRepository.findById(30L)).thenReturn(Optional.of(booking));
        when(inspectionRepository.save(any(VehicleInspection.class))).thenAnswer(invocation -> {
            VehicleInspection inspection = invocation.getArgument(0);
            inspection.setId(40L);
            return inspection;
        });
        when(uploadService.requireInspectionUploads(
                30L,
                request.getImagePublicIds(),
                null)).thenReturn(List.of(upload));
        when(imageRepository.save(any(VehicleInspectionImage.class))).thenAnswer(invocation -> {
            VehicleInspectionImage image = invocation.getArgument(0);
            image.setId(50L);
            return image;
        });

        VehicleInspectionResponse response = inspectionService.create(
                30L,
                request,
                9L,
                "ROLE_ADMIN");

        assertEquals(upload.getPublicId(), response.getImages().getFirst().getPublicId());
        assertEquals(upload.getFileUrl(), response.getImages().getFirst().getImageUrl());
        verify(inspectionAccessPolicy).requireCanManage(booking, 9L, "ROLE_ADMIN");
    }

    // ── listByBooking — authorization delegation ─────────────────────────────

    @Test
    void listByBooking_delegatesToPolicyAndReturnsData() {
        Booking booking = new Booking();
        booking.setId(30L);
        booking.setGarageId(10L);
        VehicleInspection inspection = new VehicleInspection();
        inspection.setId(40L);
        inspection.setBookingId(30L);

        when(bookingRepository.findById(30L)).thenReturn(Optional.of(booking));
        doNothing().when(inspectionAccessPolicy).requireCanRead(booking, 9L, "ROLE_STAFF");
        when(inspectionRepository.findByBookingIdOrderByCreatedAtAsc(30L))
                .thenReturn(List.of(inspection));
        when(imageRepository.findByVehicleInspectionId(40L)).thenReturn(List.of());

        List<VehicleInspectionResponse> result = inspectionService.listByBooking(30L, 9L, "ROLE_STAFF");

        assertEquals(1, result.size());
        verify(inspectionAccessPolicy).requireCanRead(booking, 9L, "ROLE_STAFF");
    }

    @Test
    void listByBooking_propagatesPolicyForbidden() {
        Booking booking = new Booking();
        booking.setId(30L);
        booking.setGarageId(10L);

        when(bookingRepository.findById(30L)).thenReturn(Optional.of(booking));
        doThrow(new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied"))
                .when(inspectionAccessPolicy).requireCanRead(booking, 7L, "ROLE_STAFF");

        var ex = assertThrows(ResponseStatusException.class,
                () -> inspectionService.listByBooking(30L, 7L, "ROLE_STAFF"));
        assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
    }

    // ── getById — authorization delegation ──────────────────────────────────

    @Test
    void getById_delegatesToPolicyAndReturnsData() {
        VehicleInspection inspection = new VehicleInspection();
        inspection.setId(40L);
        inspection.setBookingId(30L);
        Booking booking = new Booking();
        booking.setId(30L);
        booking.setGarageId(10L);

        when(inspectionRepository.findById(40L)).thenReturn(Optional.of(inspection));
        when(bookingRepository.findById(30L)).thenReturn(Optional.of(booking));
        doNothing().when(inspectionAccessPolicy).requireCanRead(booking, 9L, "ROLE_ADMIN");
        when(imageRepository.findByVehicleInspectionId(40L)).thenReturn(List.of());

        VehicleInspectionResponse result = inspectionService.getById(40L, 9L, "ROLE_ADMIN");

        assertEquals(40L, result.getId());
        verify(inspectionAccessPolicy).requireCanRead(booking, 9L, "ROLE_ADMIN");
    }

    @Test
    void getById_propagatesPolicyForbidden() {
        VehicleInspection inspection = new VehicleInspection();
        inspection.setId(40L);
        inspection.setBookingId(30L);
        Booking booking = new Booking();
        booking.setId(30L);
        booking.setGarageId(10L);

        when(inspectionRepository.findById(40L)).thenReturn(Optional.of(inspection));
        when(bookingRepository.findById(30L)).thenReturn(Optional.of(booking));
        doThrow(new ResponseStatusException(HttpStatus.FORBIDDEN, "Access denied"))
                .when(inspectionAccessPolicy).requireCanRead(booking, 7L, "ROLE_STAFF");

        var ex = assertThrows(ResponseStatusException.class,
                () -> inspectionService.getById(40L, 7L, "ROLE_STAFF"));
        assertEquals(HttpStatus.FORBIDDEN, ex.getStatusCode());
    }
}
