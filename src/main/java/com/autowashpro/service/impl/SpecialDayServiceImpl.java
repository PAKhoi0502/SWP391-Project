package com.autowashpro.service.impl;

import com.autowashpro.dto.request.CreateSpecialDayRequest;
import com.autowashpro.dto.request.UpdateSpecialDayRequest;
import com.autowashpro.dto.response.SpecialDayResponse;
import com.autowashpro.entity.SpecialDay;
import com.autowashpro.repository.SpecialDayRepository;
import com.autowashpro.service.SpecialDayService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class SpecialDayServiceImpl implements SpecialDayService {

    private static final BigDecimal DEFAULT_SURCHARGE_RATE = BigDecimal.valueOf(30);
    private static final BigDecimal HUNDRED = BigDecimal.valueOf(100);

    private final SpecialDayRepository specialDayRepository;

    @Override
    public List<SpecialDayResponse> getAll() {
        return specialDayRepository.findAllByOrderByStartDateDesc().stream()
                .map(this::toResponse)
                .toList();
    }

    @Override
    public SpecialDayResponse create(CreateSpecialDayRequest request) {
        BigDecimal surchargeRate = request.getSurchargeRate() != null
                ? request.getSurchargeRate() : DEFAULT_SURCHARGE_RATE;
        validate(request.getDayName(), request.getStartDate(), request.getEndDate(), surchargeRate);

        SpecialDay day = new SpecialDay();
        day.setDayName(request.getDayName().trim());
        day.setStartDate(request.getStartDate());
        day.setEndDate(request.getEndDate());
        day.setIsActive(true);
        day.setSurchargeRate(surchargeRate);
        specialDayRepository.save(day);

        return toResponse(day);
    }

    @Override
    public SpecialDayResponse update(Long id, UpdateSpecialDayRequest request) {
        SpecialDay day = specialDayRepository.findById(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Special day not found"));

        String dayName = request.getDayName() != null ? request.getDayName() : day.getDayName();
        LocalDate startDate = request.getStartDate() != null ? request.getStartDate() : day.getStartDate();
        LocalDate endDate = request.getEndDate() != null ? request.getEndDate() : day.getEndDate();
        BigDecimal surchargeRate = request.getSurchargeRate() != null
                ? request.getSurchargeRate() : day.getSurchargeRate();
        validate(dayName, startDate, endDate, surchargeRate);

        day.setDayName(dayName.trim());
        day.setStartDate(startDate);
        day.setEndDate(endDate);
        day.setSurchargeRate(surchargeRate);
        if (request.getIsActive() != null) {
            day.setIsActive(request.getIsActive());
        }
        specialDayRepository.save(day);

        return toResponse(day);
    }

    @Override
    public boolean isSpecialDay(LocalDate date) {
        return findMatch(date).isPresent();
    }

    @Override
    public BigDecimal getSurchargeRateForDate(LocalDate date) {
        return findMatch(date).map(SpecialDay::getSurchargeRate).orElse(BigDecimal.ZERO);
    }

    @Override
    public BigDecimal computeSurcharge(LocalDate bookingDate, BigDecimal originalPrice) {
        BigDecimal rate = getSurchargeRateForDate(bookingDate);
        if (originalPrice == null || rate.compareTo(BigDecimal.ZERO) <= 0) {
            return BigDecimal.ZERO;
        }
        return originalPrice.multiply(rate).divide(HUNDRED, 2, RoundingMode.HALF_UP);
    }

    private Optional<SpecialDay> findMatch(LocalDate date) {
        if (date == null) {
            return Optional.empty();
        }
        return specialDayRepository
                .findFirstByIsActiveTrueAndStartDateLessThanEqualAndEndDateGreaterThanEqualOrderBySurchargeRateDesc(
                        date, date);
    }

    private void validate(String dayName, LocalDate startDate, LocalDate endDate, BigDecimal surchargeRate) {
        if (dayName == null || dayName.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Day name is required");
        }
        if (startDate == null || endDate == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Start date and end date are required");
        }
        if (endDate.isBefore(startDate)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "End date must not be before start date");
        }
        if (surchargeRate == null || surchargeRate.compareTo(BigDecimal.ZERO) < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Surcharge rate must be >= 0");
        }
    }

    private SpecialDayResponse toResponse(SpecialDay day) {
        return SpecialDayResponse.builder()
                .id(day.getId())
                .dayName(day.getDayName())
                .startDate(day.getStartDate())
                .endDate(day.getEndDate())
                .isActive(day.getIsActive())
                .surchargeRate(day.getSurchargeRate())
                .build();
    }
}
