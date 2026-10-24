package com.aiworkplace.dto.response;

import lombok.Builder;
import lombok.Data;
import java.util.List;

@Data
@Builder
public class StudentPlacementDto {
    private Long id;
    private String name;
    private String email;
    private String department;
    private String rollNumber;
    private Double cgpa;
    private int readinessScore; // 0 - 100
    private String category; // "STRONG", "MODERATE", "NEEDS_PREPARATION"
    private int documentsCount;
    private int tasksCompletedCount;
    private int notesCount;
    private int totalActivities;
    private boolean hasResume;
    private List<String> topSkills;
}
