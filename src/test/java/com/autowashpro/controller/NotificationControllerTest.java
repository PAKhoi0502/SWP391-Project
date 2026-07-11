package com.autowashpro.controller;

import com.autowashpro.dto.response.NotificationResponse;
import com.autowashpro.security.JwtAuthenticationFilter;
import com.autowashpro.service.NotificationService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.request.RequestPostProcessor;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(controllers = NotificationController.class)
@AutoConfigureMockMvc(addFilters = false)
@ActiveProfiles("test")
class NotificationControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockitoBean
    private NotificationService notificationService;

    @MockitoBean
    private JwtAuthenticationFilter jwtAuthenticationFilter;

    @Test
    void getMyNotificationsUsesAuthenticatedUserIdAndPaging() throws Exception {
        NotificationResponse notification = notificationResponse();
        when(notificationService.getMyNotifications(7L, false, 2, 5))
                .thenReturn(new PageImpl<>(List.of(notification), PageRequest.of(1, 5), 1));

        mockMvc.perform(get("/notifications")
                        .param("isRead", "false")
                        .param("page", "2")
                        .param("limit", "5")
                        .with(authenticatedUser(7L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.data.content[0].eventType").value("BOOKING_CONFIRMED"));

        verify(notificationService).getMyNotifications(7L, false, 2, 5);
    }

    @Test
    void getMyNotificationDetailUsesAuthenticatedUserId() throws Exception {
        when(notificationService.getMyNotificationDetail(1L, 7L)).thenReturn(notificationResponse());

        mockMvc.perform(get("/notifications/1")
                        .with(authenticatedUser(7L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.id").value(1));

        verify(notificationService).getMyNotificationDetail(1L, 7L);
    }

    @Test
    void getMyNotificationDetailReturnsForbiddenFromOwnershipCheck() throws Exception {
        when(notificationService.getMyNotificationDetail(1L, 7L))
                .thenThrow(new ResponseStatusException(HttpStatus.FORBIDDEN, "You cannot access this notification"));

        mockMvc.perform(get("/notifications/1")
                        .with(authenticatedUser(7L)))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("You cannot access this notification"));
    }

    @Test
    void markAsReadUsesAuthenticatedUserId() throws Exception {
        NotificationResponse response = notificationResponse();
        response.setIsRead(true);
        response.setReadAt(LocalDateTime.now());
        when(notificationService.markAsRead(1L, 7L)).thenReturn(response);

        mockMvc.perform(patch("/notifications/1/read")
                        .with(authenticatedUser(7L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data.isRead").value(true));

        verify(notificationService).markAsRead(1L, 7L);
    }

    @Test
    void markAllAsReadUsesAuthenticatedUserId() throws Exception {
        when(notificationService.markAllAsRead(7L)).thenReturn(3);

        mockMvc.perform(patch("/notifications/read-all")
                        .with(authenticatedUser(7L)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.data").value(3));

        verify(notificationService).markAllAsRead(7L);
    }

    @Test
    void deleteNotificationUsesAuthenticatedUserId() throws Exception {
        mockMvc.perform(delete("/notifications/1")
                        .with(authenticatedUser(7L)))
                .andExpect(status().isNoContent());

        verify(notificationService).deleteNotification(1L, 7L);
    }

    private RequestPostProcessor authenticatedUser(Long userId) {
        return request -> {
            UserDetails userDetails = User.withUsername(String.valueOf(userId))
                    .password("password")
                    .roles("CUSTOMER")
                    .build();
            SecurityContextHolder.getContext().setAuthentication(
                    new UsernamePasswordAuthenticationToken(
                            userDetails,
                            null,
                            userDetails.getAuthorities()));
            return request;
        };
    }

    private NotificationResponse notificationResponse() {
        return NotificationResponse.builder()
                .id(1L)
                .userId(7L)
                .bookingId(20L)
                .channel("APP")
                .eventType("BOOKING_CONFIRMED")
                .title("Booking Confirmed")
                .message("Your booking is confirmed")
                .isRead(false)
                .sentAt(LocalDateTime.now())
                .createdAt(LocalDateTime.now())
                .build();
    }
}
