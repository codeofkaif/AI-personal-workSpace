package com.aiworkplace.controller;

import com.aiworkplace.entity.User;
import com.aiworkplace.service.AuthService;
import com.aiworkplace.service.UserActivityService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/activities")
@RequiredArgsConstructor
public class UserActivityController {

    private final AuthService authService;
    private final UserActivityService activityService;

    @PostMapping("/log")
    public ResponseEntity<Void> logEvent(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody Map<String, String> body) {
        User user = authService.getCurrentUser(userDetails.getUsername());
        String action = body.getOrDefault("action", "USER_EVENT");
        String details = body.getOrDefault("details", "");
        activityService.logActivity(user, action, details);
        return ResponseEntity.ok().build();
    }
}
