package com.autowashpro.exception;

import com.autowashpro.common.ApiResponse;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.server.ResponseStatusException;

import java.util.Objects;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<ApiResponse<Object>> handleResponseStatusException(
            ResponseStatusException ex) {

        String message = ex.getReason() != null
                ? ex.getReason()
                : ex.getMessage();

        return ResponseEntity.status(ex.getStatusCode()).body(
                errorResponse(message)
        );
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<Object>> handleValidationException(
            MethodArgumentNotValidException ex) {

        String message = ex.getBindingResult()
                .getFieldErrors()
                .stream()
                .findFirst()
                .map(error -> error.getField() + ": " + Objects.requireNonNullElse(
                        error.getDefaultMessage(),
                        "invalid value"))
                .orElse("Validation failed");

        return ResponseEntity.badRequest().body(
                errorResponse(message)
        );
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<Object>> handleException(
            Exception ex) {

        return ResponseEntity.badRequest().body(
                errorResponse(ex.getMessage())
        );
    }

    private ApiResponse<Object> errorResponse(String message) {
        return ApiResponse.builder()
                .success(false)
                .message(message != null ? message : "Request failed")
                .data(null)
                .build();
    }
}
