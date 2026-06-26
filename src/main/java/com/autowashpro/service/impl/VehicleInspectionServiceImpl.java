package com.autowashpro.service.impl;

import com.autowashpro.dto.request.VehicleInspectionCreateRequest;
import com.autowashpro.dto.request.VehicleInspectionUpdateRequest;
import com.autowashpro.dto.response.VehicleInspectionImageResponse;
import com.autowashpro.dto.response.VehicleInspectionResponse;
import com.autowashpro.entity.Booking;
import com.autowashpro.entity.StaffProfile;
import com.autowashpro.entity.VehicleInspection;
import com.autowashpro.entity.VehicleInspectionImage;
import com.autowashpro.repository.*;
import com.autowashpro.service.VehicleInspectionService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class VehicleInspectionServiceImpl implements VehicleInspectionService {

    private final VehicleInspectionRepository inspectionRepository;
    private final VehicleInspectionImageRepository imageRepository;
    private final BookingRepository bookingRepository;
    private final StaffProfileRepository staffProfileRepository;

    private static final List<String> VALID_TYPES = List.of("BEFORE_WASH", "AFTER_WASH");

    @Override
    @Transactional
    public VehicleInspectionResponse create(Long bookingId, VehicleInspectionCreateRequest request, Long staffUserId) {

        // 1. Validate inspection type
        if (!VALID_TYPES.contains(request.getInspectionType())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Invalid inspection type: " + request.getInspectionType() + ". Must be BEFORE_WASH or AFTER_WASH");
        }

        // 2. Validate booking tồn tại
        Booking booking = bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Booking not found: " + bookingId));

        // 3. Validate staff profile và garage permission
        StaffProfile staffProfile = staffProfileRepository.findByUser_Id(staffUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "No staff profile found for current user"));

        if (!Boolean.TRUE.equals(staffProfile.getIsActive())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Staff profile is inactive");
        }

        if (!staffProfile.getGarageId().equals(booking.getGarageId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Staff cannot inspect booking from another garage");
        }

        // 4. Tạo inspection
        VehicleInspection inspection = new VehicleInspection();
        inspection.setBookingId(bookingId);
        // vehicle_id: lấy từ booking nếu có, null nếu walk-in
        inspection.setVehicleId(booking.getVehicleId());
        inspection.setGarageId(booking.getGarageId());
        inspection.setInspectedByStaffId(staffUserId);
        inspection.setType(request.getInspectionType());
        inspection.setExteriorCondition(request.getExteriorCondition());
        inspection.setInteriorCondition(request.getInteriorCondition());
        inspection.setNotes(request.getNotes());

        VehicleInspection saved = inspectionRepository.save(inspection);

        // 5. Lưu images nếu có
        List<VehicleInspectionImage> savedImages = new ArrayList<>();
        if (request.getImages() != null && !request.getImages().isEmpty()) {
            for (String url : request.getImages()) {
                VehicleInspectionImage img = new VehicleInspectionImage();
                img.setVehicleInspectionId(saved.getId());
                img.setImageUrl(url);
                savedImages.add(imageRepository.save(img));
            }
        }

        return toResponse(saved, savedImages);
    }

    @Override
    public List<VehicleInspectionResponse> listByBooking(Long bookingId, Long currentUserId, String role) {
        // Validate booking tồn tại
        bookingRepository.findById(bookingId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Booking not found: " + bookingId));

        // CUSTOMER chỉ xem được booking của chính mình
        if ("ROLE_CUSTOMER".equals(role)) {
            Booking booking = bookingRepository.findById(bookingId).get();
            if (!currentUserId.equals(booking.getCustomerId())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "You can only view inspections of your own bookings");
            }
        }

        List<VehicleInspection> inspections = inspectionRepository.findByBookingIdOrderByCreatedAtAsc(bookingId);
        return inspections.stream()
                .map(i -> toResponse(i, imageRepository.findByVehicleInspectionId(i.getId())))
                .collect(Collectors.toList());
    }

    @Override
    public VehicleInspectionResponse getById(Long id, Long currentUserId, String role) {
        VehicleInspection inspection = inspectionRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Inspection not found: " + id));

        // CUSTOMER chỉ xem được inspection của booking của mình
        if ("ROLE_CUSTOMER".equals(role)) {
            Booking booking = bookingRepository.findById(inspection.getBookingId())
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Booking not found"));
            if (!currentUserId.equals(booking.getCustomerId())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "You can only view inspections of your own bookings");
            }
        }

        List<VehicleInspectionImage> images = imageRepository.findByVehicleInspectionId(id);
        return toResponse(inspection, images);
    }

    @Override
    @Transactional
    public VehicleInspectionResponse update(Long id, VehicleInspectionUpdateRequest request, Long staffUserId) {
        VehicleInspection inspection = inspectionRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND,
                        "Inspection not found: " + id));

        // Validate staff permission
        StaffProfile staffProfile = staffProfileRepository.findByUser_Id(staffUserId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "No staff profile found for current user"));

        if (!staffProfile.getGarageId().equals(inspection.getGarageId())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Staff cannot update inspection from another garage");
        }

        if (request.getNotes() != null) inspection.setNotes(request.getNotes());
        if (request.getExteriorCondition() != null) inspection.setExteriorCondition(request.getExteriorCondition());
        if (request.getInteriorCondition() != null) inspection.setInteriorCondition(request.getInteriorCondition());

        VehicleInspection updated = inspectionRepository.save(inspection);

        // Update images nếu có
        List<VehicleInspectionImage> images;
        if (request.getImages() != null) {
            // Xóa ảnh cũ, thêm ảnh mới
            List<VehicleInspectionImage> oldImages = imageRepository.findByVehicleInspectionId(id);
            imageRepository.deleteAll(oldImages);

            images = new ArrayList<>();
            for (String url : request.getImages()) {
                VehicleInspectionImage img = new VehicleInspectionImage();
                img.setVehicleInspectionId(id);
                img.setImageUrl(url);
                images.add(imageRepository.save(img));
            }
        } else {
            images = imageRepository.findByVehicleInspectionId(id);
        }

        return toResponse(updated, images);
    }

    private VehicleInspectionResponse toResponse(VehicleInspection i, List<VehicleInspectionImage> images) {
        return VehicleInspectionResponse.builder()
                .id(i.getId())
                .bookingId(i.getBookingId())
                .vehicleId(i.getVehicleId())
                .garageId(i.getGarageId())
                .inspectedByStaffId(i.getInspectedByStaffId())
                .type(i.getType())
                .exteriorCondition(i.getExteriorCondition())
                .interiorCondition(i.getInteriorCondition())
                .notes(i.getNotes())
                .images(images.stream()
                        .map(img -> VehicleInspectionImageResponse.builder()
                                .id(img.getId())
                                .imageUrl(img.getImageUrl())
                                .publicId(img.getPublicId())
                                .build())
                        .collect(Collectors.toList()))
                .createdAt(i.getCreatedAt())
                .updatedAt(i.getUpdatedAt())
                .build();
    }
}