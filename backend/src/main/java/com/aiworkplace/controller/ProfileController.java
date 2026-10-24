package com.aiworkplace.controller;

import com.aiworkplace.dto.response.StudentPlacementDto;
import com.aiworkplace.entity.User;
import com.aiworkplace.repository.UserRepository;
import com.aiworkplace.service.AdminService;
import com.aiworkplace.service.AuthService;
import com.aiworkplace.service.UserActivityService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/profile")
@RequiredArgsConstructor
public class ProfileController {

    private final AuthService authService;
    private final UserRepository userRepository;
    private final AdminService adminService;
    private final UserActivityService activityService;

    @GetMapping("/me")
    public ResponseEntity<Map<String, Object>> getMyProfile(@AuthenticationPrincipal UserDetails userDetails) {
        User user = authService.getCurrentUser(userDetails.getUsername());

        Map<String, Object> profile = new HashMap<>();
        profile.put("id", user.getId());
        profile.put("name", user.getName());
        profile.put("email", user.getEmail());
        profile.put("role", user.getRole().name());
        profile.put("department", user.getDepartment() != null ? user.getDepartment() : "Computer Science & Engineering");
        profile.put("rollNumber", user.getRollNumber() != null ? user.getRollNumber() : "CS2026-" + user.getId());
        profile.put("college", user.getCollege() != null ? user.getCollege().getName() : "Babu Banarasi Das University");
        profile.put("cgpa", user.getCgpa() != null ? user.getCgpa() : 8.5);
        profile.put("createdAt", user.getCreatedAt());

        // Include placement readiness score for the student themselves
        if (user.getRole() == User.Role.STUDENT) {
            List<StudentPlacementDto> placementList = adminService.getPlacementAnalysis(null, null);
            placementList.stream()
                .filter(p -> p.getId().equals(user.getId()))
                .findFirst()
                .ifPresent(p -> {
                    profile.put("placementScore", p.getReadinessScore());
                    profile.put("placementCategory", p.getCategory());
                    profile.put("topSkills", p.getTopSkills());
                    profile.put("hasResume", p.isHasResume());
                    profile.put("tasksCompleted", p.getTasksCompletedCount());
                    profile.put("notesCount", p.getNotesCount());
                });
        }

        return ResponseEntity.ok(profile);
    }

    @PutMapping("/me")
    public ResponseEntity<Map<String, Object>> updateMyProfile(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestBody Map<String, Object> updates) {
        User user = authService.getCurrentUser(userDetails.getUsername());

        if (updates.containsKey("name") && updates.get("name") != null) {
            user.setName((String) updates.get("name"));
        }
        if (updates.containsKey("department") && updates.get("department") != null) {
            user.setDepartment((String) updates.get("department"));
        }
        if (updates.containsKey("rollNumber") && updates.get("rollNumber") != null) {
            user.setRollNumber((String) updates.get("rollNumber"));
        }
        userRepository.save(user);

        activityService.logActivity(user, "PROFILE_UPDATE", "Updated personal profile information");
        return getMyProfile(userDetails);
    }

    /**
     * Secure endpoint: Strictly protects student profile from unauthorized students.
     * Another student CANNOT view another student's profile.
     */
    @GetMapping("/student/{studentId}")
    public ResponseEntity<?> getStudentProfileSecure(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long studentId) {
        User requestingUser = authService.getCurrentUser(userDetails.getUsername());

        // Isolation rule: If requester is a student and trying to view another student's profile -> 403 Forbidden!
        if (requestingUser.getRole() == User.Role.STUDENT && !requestingUser.getId().equals(studentId)) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN)
                .body(Map.of("error", "Access Denied: You cannot access another student's private profile."));
        }

        User targetStudent = userRepository.findById(studentId)
            .orElseThrow(() -> new RuntimeException("Student not found"));

        // Redacted safe view: password and private fields are NEVER exposed
        Map<String, Object> safeView = new HashMap<>();
        safeView.put("id", targetStudent.getId());
        safeView.put("name", targetStudent.getName());
        safeView.put("department", targetStudent.getDepartment());
        safeView.put("rollNumber", targetStudent.getRollNumber());
        safeView.put("college", targetStudent.getCollege() != null ? targetStudent.getCollege().getName() : null);

        return ResponseEntity.ok(safeView);
    }
}
