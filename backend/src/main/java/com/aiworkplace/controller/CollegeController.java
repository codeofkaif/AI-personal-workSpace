package com.aiworkplace.controller;

import com.aiworkplace.dto.response.CollegeResponse;
import com.aiworkplace.service.CollegeService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/colleges")
@RequiredArgsConstructor
public class CollegeController {

    private final CollegeService collegeService;

    @GetMapping
    public ResponseEntity<List<CollegeResponse>> getAllColleges() {
        return ResponseEntity.ok(collegeService.getAllColleges());
    }

    @GetMapping("/{id}")
    public ResponseEntity<CollegeResponse> getCollege(@PathVariable Long id) {
        return ResponseEntity.ok(collegeService.getCollegeById(id));
    }
}
