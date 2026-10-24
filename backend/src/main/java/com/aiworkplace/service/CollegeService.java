package com.aiworkplace.service;

import com.aiworkplace.dto.response.CollegeResponse;
import com.aiworkplace.entity.College;
import com.aiworkplace.repository.CollegeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
@RequiredArgsConstructor
public class CollegeService {

    private final CollegeRepository collegeRepository;

    public List<CollegeResponse> getAllColleges() {
        return collegeRepository.findAll().stream().map(this::toResponse).toList();
    }

    public CollegeResponse getCollegeById(Long id) {
        College c = collegeRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("College not found: " + id));
        return toResponse(c);
    }

    private CollegeResponse toResponse(College c) {
        return CollegeResponse.builder()
            .id(c.getId()).name(c.getName()).code(c.getCode())
            .description(c.getDescription()).createdAt(c.getCreatedAt())
            .build();
    }
}
