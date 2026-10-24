package com.aiworkplace.controller;

import com.aiworkplace.dto.response.StudentPlacementDto;
import com.aiworkplace.entity.User;
import com.aiworkplace.entity.UserActivity;
import com.aiworkplace.service.AdminService;
import com.aiworkplace.service.AuthService;
import com.aiworkplace.service.UserActivityService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN', 'COLLEGE_ADMIN')")
public class AdminController {

    private final AdminService adminService;
    private final AuthService authService;
    private final UserActivityService activityService;

    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getStats() {
        return ResponseEntity.ok(adminService.getAdminStats());
    }

    @GetMapping("/placement-categories")
    public ResponseEntity<List<StudentPlacementDto>> getPlacementCategories(
            @RequestParam(required = false) String department,
            @RequestParam(required = false) String category) {
        return ResponseEntity.ok(adminService.getPlacementAnalysis(department, category));
    }

    @GetMapping("/activities")
    public ResponseEntity<List<UserActivity>> getActivities(
            @RequestParam(defaultValue = "50") int limit) {
        return ResponseEntity.ok(activityService.getRecentActivities(limit));
    }

    @GetMapping("/users")
    public ResponseEntity<List<Map<String, Object>>> getUsers() {
        return ResponseEntity.ok(adminService.getAllUsers());
    }

    @PutMapping("/users/{id}/role")
    public ResponseEntity<Void> updateUserRole(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long id,
            @RequestBody Map<String, String> body) {
        User admin = authService.getCurrentUser(userDetails.getUsername());
        String newRole = body.get("role");
        if (newRole == null || newRole.isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        adminService.updateUserRole(id, newRole, admin);
        return ResponseEntity.ok().build();
    }
}
