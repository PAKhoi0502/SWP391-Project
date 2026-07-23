package com.autowashpro.security;

import com.autowashpro.entity.User;
import com.autowashpro.repository.UserRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.*;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
@RequiredArgsConstructor
public class CustomUserDetailsService
        implements UserDetailsService {

    private final UserRepository userRepository;

    @Override
    public UserDetails loadUserByUsername(
            String userId) throws UsernameNotFoundException {

        User user = userRepository.findById(
                        Long.valueOf(userId))
                .orElseThrow(() ->
                        new UsernameNotFoundException(
                                "User not found"));

        String role = user.getRole();
        String authority = (role != null && role.startsWith("ROLE_")) ? role : "ROLE_" + role;
        String passwordHash = user.getPasswordHash() != null ? user.getPasswordHash() : "";
        return new org.springframework.security.core.userdetails.User(
                user.getId().toString(),
                passwordHash,
                List.of(new SimpleGrantedAuthority(authority))
        );
    }
}