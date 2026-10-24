package com.aiworkplace.service;

import com.aiworkplace.dto.request.*;
import com.aiworkplace.dto.response.AuthResponse;
import com.aiworkplace.entity.*;
import com.aiworkplace.repository.*;
import com.aiworkplace.security.JwtUtils;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.*;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class AuthService {

    private final UserRepository userRepository;
    private final CollegeRepository collegeRepository;
    private final PasswordEncoder passwordEncoder;
    private final JwtUtils jwtUtils;
    private final AuthenticationManager authenticationManager;

    public AuthResponse register(RegisterRequest req) {
        if (userRepository.existsByEmail(req.getEmail())) {
            throw new RuntimeException("Email already registered: " + req.getEmail());
        }
        College college = null;
        if (req.getCollegeCode() != null && !req.getCollegeCode().isBlank()) {
            college = collegeRepository.findByCode(req.getCollegeCode())
                .orElseThrow(() -> new RuntimeException("College not found: " + req.getCollegeCode()));
        }
        User user = User.builder()
            .name(req.getName())
            .email(req.getEmail())
            .password(passwordEncoder.encode(req.getPassword()))
            .role(User.Role.valueOf(req.getRole().toUpperCase()))
            .college(college)
            .department(req.getDepartment() != null ? req.getDepartment() : "Computer Science & Engineering")
            .rollNumber("CS2026-" + (System.currentTimeMillis() % 900 + 100))
            .cgpa(8.2)
            .build();
        user = userRepository.save(user);
        String token = jwtUtils.generateToken(user.getEmail());
        return AuthResponse.builder()
            .token(token)
            .userId(user.getId())
            .name(user.getName())
            .email(user.getEmail())
            .role(user.getRole().name())
            .collegeName(college != null ? college.getName() : null)
            .build();
    }

    public AuthResponse login(LoginRequest req) {
        Authentication auth = authenticationManager.authenticate(
            new UsernamePasswordAuthenticationToken(req.getEmail(), req.getPassword())
        );
        User user = userRepository.findByEmail(req.getEmail())
            .orElseThrow(() -> new RuntimeException("User not found"));
        String token = jwtUtils.generateToken(user.getEmail());
        return AuthResponse.builder()
            .token(token)
            .userId(user.getId())
            .name(user.getName())
            .email(user.getEmail())
            .role(user.getRole().name())
            .collegeName(user.getCollege() != null ? user.getCollege().getName() : null)
            .build();
    }

    public User getCurrentUser(String email) {
        return userRepository.findByEmail(email)
            .orElseThrow(() -> new RuntimeException("User not found"));
    }
}
