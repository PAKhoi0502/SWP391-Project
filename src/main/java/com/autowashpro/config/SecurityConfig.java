package com.autowashpro.config;

import com.autowashpro.security.JwtAuthenticationFilter;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.*;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

@Configuration
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

        private final JwtAuthenticationFilter jwtFilter;

        @Bean
        public SecurityFilterChain securityFilterChain(
                        HttpSecurity http) throws Exception {

                http
                                .csrf(csrf -> csrf.disable())
                                .sessionManagement(session -> session.sessionCreationPolicy(
                                                SessionCreationPolicy.STATELESS))
                                .authorizeHttpRequests(auth -> auth
                                                .requestMatchers(
                                                                "/health",
                                                                "/api/v1",
                                                                "/swagger-ui/**",
                                                                "/swagger-ui.html",
                                                                "/v3/api-docs/**",
                                                                "/auth/register",
                                                                "/auth/login",
                                                                "/auth/refresh-token",
                                                                "/auth/logout",
                                                                "/auth/forgot-password",
                                                                "/auth/reset-password")
                                                .permitAll()
                                                .requestMatchers(
                                                                "/users")
                                                .hasRole("ADMIN")

                                                .requestMatchers(
                                                                "/users/*")
                                                .hasRole("ADMIN")

                                                .requestMatchers(
                                                                "/users/*/status")
                                                .hasRole("ADMIN")

                                                .requestMatchers(
                                                                "/users/*/role")
                                                .hasRole("ADMIN")

                                                .requestMatchers(
                                                                "/service-packages",
                                                                "/service-packages/*",
                                                                "/service-packages/*/status")
                                                .hasRole("ADMIN")

                                                .requestMatchers(
                                                                "/service-packages/available")
                                                .permitAll()

                                                .requestMatchers(
                                                                "/users/me")
                                                .authenticated()

                                                .anyRequest()
                                                .authenticated())
                                .addFilterBefore(
                                                jwtFilter,
                                                UsernamePasswordAuthenticationFilter.class);

                return http.build();
        }
}