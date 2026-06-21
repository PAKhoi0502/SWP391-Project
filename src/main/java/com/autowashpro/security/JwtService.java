package com.autowashpro.security;

import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.stereotype.Service;

import javax.crypto.SecretKey;
import java.util.Date;

@Service
public class JwtService {

    private static final String SECRET =
            "AutoWashProSecretKeyForJwtAuthentication2026SuperSecureKey";

    private final SecretKey key =
            Keys.hmacShaKeyFor(SECRET.getBytes());

    public String generateToken(Long userId, String role) {

        return Jwts.builder()
                .subject(userId.toString())
                .claim("role", role)
                .issuedAt(new Date())
                .expiration(
                        new Date(
                                System.currentTimeMillis()
                                        + 1000 * 60 * 60 * 24
                        )
                )
                .signWith(key)
                .compact();
    }

    public Claims extractClaims(String token) {

        return Jwts.parser()
                .verifyWith(key)
                .build()
                .parseSignedClaims(token)
                .getPayload();
    }

    public Long extractUserId(String token) {
        return Long.valueOf(
                extractClaims(token).getSubject()
        );
    }
    public String generateRefreshToken(Long userId) {

    return Jwts.builder()
            .subject(userId.toString())
            .issuedAt(new Date())
            .expiration(
                    new Date(
                            System.currentTimeMillis()
                                    + 1000L * 60 * 60 * 24 * 30
                    )
            )
            .signWith(key)
            .compact();
}
}