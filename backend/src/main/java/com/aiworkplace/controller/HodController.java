package com.aiworkplace.controller;

import com.aiworkplace.dto.response.StudentPlacementDto;
import com.aiworkplace.entity.User;
import com.aiworkplace.service.AdminService;
import com.aiworkplace.service.AuthService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.*;

@RestController
@RequestMapping("/api/hod")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('ADMIN', 'COLLEGE_ADMIN', 'DEAN', 'HOD')")
public class HodController {

    private final AdminService adminService;
    private final AuthService authService;

    @GetMapping("/overview")
    public ResponseEntity<Map<String, Object>> getHodOverview(@AuthenticationPrincipal UserDetails userDetails) {
        User user = authService.getCurrentUser(userDetails.getUsername());
        String dept = user.getDepartment() != null ? user.getDepartment() : "Computer Science & Engineering";

        List<StudentPlacementDto> deptStudents = adminService.getPlacementAnalysis(dept, null);
        if (deptStudents.isEmpty()) {
            deptStudents = adminService.getPlacementAnalysis(null, null);
        }

        long strong = deptStudents.stream().filter(s -> "STRONG".equals(s.getCategory())).count();
        long moderate = deptStudents.stream().filter(s -> "MODERATE".equals(s.getCategory())).count();
        long needsPrep = deptStudents.stream().filter(s -> "NEEDS_PREPARATION".equals(s.getCategory())).count();

        Map<String, Object> map = new HashMap<>();
        map.put("department", dept);
        map.put("hodName", user.getName());
        map.put("totalStudents", deptStudents.size());
        map.put("placementStrong", strong);
        map.put("placementModerate", moderate);
        map.put("placementNeedsPrep", needsPrep);
        map.put("students", deptStudents);

        return ResponseEntity.ok(map);
    }
}
