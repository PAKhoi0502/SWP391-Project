package com.autowashpro.service;

import com.autowashpro.dto.request.CreateSpecialDayRequest;
import com.autowashpro.dto.request.UpdateSpecialDayRequest;
import com.autowashpro.dto.response.SpecialDayResponse;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public interface SpecialDayService {

    List<SpecialDayResponse> getAll();

    SpecialDayResponse create(CreateSpecialDayRequest request);

    SpecialDayResponse update(Long id, UpdateSpecialDayRequest request);

    boolean isSpecialDay(LocalDate date);

    /**
     * Admin-configured surcharge percentage (e.g. 30 means 30%) for whichever active
     * special day covers this date — {@link BigDecimal#ZERO} if the date isn't a special day.
     */
    BigDecimal getSurchargeRateForDate(LocalDate date);

    /**
     * Holiday surcharge applied on top of a booking's original price when its date
     * falls inside an active special day — {@link BigDecimal#ZERO} otherwise.
     */
    BigDecimal computeSurcharge(LocalDate bookingDate, BigDecimal originalPrice);
}
