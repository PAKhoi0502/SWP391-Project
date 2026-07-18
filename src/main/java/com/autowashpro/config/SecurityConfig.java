package com.autowashpro.config;

import com.autowashpro.security.JwtAuthenticationFilter;
import lombok.RequiredArgsConstructor;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;
import org.springframework.security.config.http.SessionCreationPolicy;
import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;

import org.springframework.web.cors.CorsConfiguration;
import org.springframework.web.cors.CorsConfigurationSource;
import org.springframework.web.cors.UrlBasedCorsConfigurationSource;

import java.util.List;

@Configuration
@EnableMethodSecurity
@RequiredArgsConstructor
public class SecurityConfig {

    private final JwtAuthenticationFilter jwtFilter;

    @Bean
    public SecurityFilterChain securityFilterChain(
            HttpSecurity http) throws Exception {

        http
                .cors(cors -> cors.configurationSource(corsConfigurationSource()))
                .csrf(csrf -> csrf.disable())
                .sessionManagement(session -> session.sessionCreationPolicy(
                        SessionCreationPolicy.STATELESS))
                .authorizeHttpRequests(auth -> auth
                        .requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()

                        .requestMatchers(
                                "/health",
                                "/api/v1",
                                "/swagger-ui/**",
                                "/swagger-ui.html",
                                "/v3/api-docs/**",
                                "/auth/register",
                                "/auth/login",
                                "/auth/google",
                                "/auth/refresh-token",
                                "/auth/logout",
                                "/auth/forgot-password",
                                "/auth/reset-password",
                                "/payments/payos/webhook",
                                "/public/reviews",
                                "/public/reviews/stats")
                        .permitAll()

                        .requestMatchers(
                                "/users/me",
                                "/auth/me")
                        .authenticated()

                        .requestMatchers(
                                "/users",
                                "/users/*",
                                "/users/*/status",
                                "/users/*/role")
                        .hasRole("ADMIN")

                        .requestMatchers(HttpMethod.GET, "/service-packages/available")
.permitAll()

.requestMatchers(HttpMethod.GET, "/service-packages")
.permitAll()

.requestMatchers(HttpMethod.GET, "/service-packages/*")
.permitAll()

.requestMatchers(HttpMethod.POST, "/service-packages")
.hasRole("ADMIN")

.requestMatchers(HttpMethod.PATCH, "/service-packages/*")
.hasRole("ADMIN")

.requestMatchers(HttpMethod.PATCH, "/service-packages/*/status")
.hasRole("ADMIN")

                        .anyRequest()
                        .authenticated())
                .addFilterBefore(
                        jwtFilter,
                        UsernamePasswordAuthenticationFilter.class);

        return http.build();
    }

    @Bean
    public CorsConfigurationSource corsConfigurationSource() {
        CorsConfiguration configuration = new CorsConfiguration();

        configuration.setAllowedOrigins(List.of(
                "http://localhost:5173",
                "http://127.0.0.1:5173"
        ));

        configuration.setAllowedMethods(List.of(
                "GET",
                "POST",
                "PUT",
                "PATCH",
                "DELETE",
                "OPTIONS"
        ));

        configuration.setAllowedHeaders(List.of("*"));
        configuration.setAllowCredentials(true);

        UrlBasedCorsConfigurationSource source =
                new UrlBasedCorsConfigurationSource();

        source.registerCorsConfiguration("/**", configuration);

        return source;
    }
}
