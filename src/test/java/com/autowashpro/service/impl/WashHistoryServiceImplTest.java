package com.autowashpro.service.impl;

import com.autowashpro.entity.Booking;
import com.autowashpro.entity.PointTransaction;
import com.autowashpro.entity.ServicePackage;
import com.autowashpro.entity.User;
import com.autowashpro.entity.Vehicle;
import com.autowashpro.entity.WashHistory;
import com.autowashpro.repository.BookingRepository;
import com.autowashpro.repository.GarageRepository;
import com.autowashpro.repository.PointTransactionRepository;
import com.autowashpro.repository.ServicePackageRepository;
import com.autowashpro.repository.UserRepository;
import com.autowashpro.repository.VehicleRepository;
import com.autowashpro.repository.WashHistoryRepository;
import com.autowashpro.support.TestFixtures;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WashHistoryServiceImplTest {

    @Mock
    private WashHistoryRepository washHistoryRepository;

    @Mock
    private BookingRepository bookingRepository;

    @Mock
    private PointTransactionRepository pointTransactionRepository;

    @Mock
    private VehicleRepository vehicleRepository;

    @Mock
    private GarageRepository garageRepository;

    @Mock
    private ServicePackageRepository servicePackageRepository;

    @Mock
    private UserRepository userRepository;

    @InjectMocks
    private WashHistoryServiceImpl washHistoryService;

    @Test
    void createWashHistoryAfterPaidBookingPersistsHistoryWithEarnedPoints() {
        Booking booking = paidCompletedBooking();
        PointTransaction earnTransaction = new PointTransaction();
        earnTransaction.setPoints(25);
        when(washHistoryRepository.findByBookingId(booking.getId())).thenReturn(Optional.empty());
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));
        when(pointTransactionRepository.findByBookingIdAndType(booking.getId(), "EARN"))
                .thenReturn(Optional.of(earnTransaction));
        ArgumentCaptor<WashHistory> historyCaptor = ArgumentCaptor.forClass(WashHistory.class);

        washHistoryService.createWashHistoryAfterPaidBooking(booking.getId());

        verify(washHistoryRepository).save(historyCaptor.capture());
        WashHistory history = historyCaptor.getValue();
        assertEquals(booking.getId(), history.getBookingId());
        assertEquals(booking.getCustomerId(), history.getCustomerId());
        assertEquals(booking.getVehicleId(), history.getVehicleId());
        assertEquals(booking.getGarageId(), history.getGarageId());
        assertEquals(booking.getServicePackageId(), history.getServicePackageId());
        assertEquals(booking.getCompletedAt(), history.getCompletedAt());
        assertEquals(booking.getPaidAt(), history.getPaidAt());
        assertEquals(booking.getFinalPrice(), history.getFinalPrice());
        assertEquals(25, history.getEarnedPoints());
    }

    @Test
    void createWashHistoryAfterPaidBookingIsIdempotentWhenHistoryExists() {
        WashHistory existing = new WashHistory();
        existing.setId(1L);
        when(washHistoryRepository.findByBookingId(20L)).thenReturn(Optional.of(existing));

        washHistoryService.createWashHistoryAfterPaidBooking(20L);

        verify(bookingRepository, never()).findById(any());
        verify(washHistoryRepository, never()).save(any());
    }

    @Test
    void createWashHistoryAfterPaidBookingSkipsUnpaidBooking() {
        Booking booking = paidCompletedBooking();
        booking.setPaymentStatus("UNPAID");
        when(washHistoryRepository.findByBookingId(booking.getId())).thenReturn(Optional.empty());
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));

        washHistoryService.createWashHistoryAfterPaidBooking(booking.getId());

        verify(washHistoryRepository, never()).save(any());
    }

    @Test
    void createWashHistoryAfterPaidBookingSkipsNonCompletedBooking() {
        Booking booking = paidCompletedBooking();
        booking.setStatus("IN_PROGRESS");
        when(washHistoryRepository.findByBookingId(booking.getId())).thenReturn(Optional.empty());
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));

        washHistoryService.createWashHistoryAfterPaidBooking(booking.getId());

        verify(washHistoryRepository, never()).save(any());
    }

    @Test
    void createWashHistoryAfterPaidBookingSkipsGuestBooking() {
        Booking booking = paidCompletedBooking();
        booking.setCustomerId(null);
        when(washHistoryRepository.findByBookingId(booking.getId())).thenReturn(Optional.empty());
        when(bookingRepository.findById(booking.getId())).thenReturn(Optional.of(booking));

        washHistoryService.createWashHistoryAfterPaidBooking(booking.getId());

        verify(washHistoryRepository, never()).save(any());
    }

    private Booking paidCompletedBooking() {
        User customer = TestFixtures.customer();
        Vehicle vehicle = TestFixtures.car(customer);
        ServicePackage servicePackage = TestFixtures.carWashPackage();
        Booking booking = TestFixtures.confirmedBooking(customer, vehicle, TestFixtures.garage(), servicePackage);
        booking.setId(20L);
        booking.setStatus("COMPLETED");
        booking.setPaymentStatus("PAID");
        booking.setCompletedAt(TestFixtures.BASE_TIME.plusHours(1));
        booking.setPaidAt(TestFixtures.BASE_TIME.plusHours(2));
        return booking;
    }
}
