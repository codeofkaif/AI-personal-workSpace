package com.aiworkplace.service;

import com.aiworkplace.dto.response.StudentPlacementDto;
import com.aiworkplace.entity.*;
import com.aiworkplace.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AdminService {

    private final UserRepository userRepository;
    private final DocumentRepository documentRepository;
    private final TaskRepository taskRepository;
    private final NoteRepository noteRepository;
    private final NoticeRepository noticeRepository;
    private final UserActivityRepository activityRepository;
    private final UserActivityService activityService;

    public Map<String, Object> getAdminStats() {
        long totalStudents = userRepository.countByRole(User.Role.STUDENT);
        long totalDocs = documentRepository.count();
        long totalTasks = taskRepository.count();
        long totalNotes = noteRepository.count();
        long totalNotices = noticeRepository.count();

        List<StudentPlacementDto> placementList = getPlacementAnalysis(null, null);
        long strongCount = placementList.stream().filter(p -> "STRONG".equals(p.getCategory())).count();
        long moderateCount = placementList.stream().filter(p -> "MODERATE".equals(p.getCategory())).count();
        long needsPrepCount = placementList.stream().filter(p -> "NEEDS_PREPARATION".equals(p.getCategory())).count();

        Map<String, Object> stats = new HashMap<>();
        stats.put("totalStudents", totalStudents);
        stats.put("totalDocuments", totalDocs);
        stats.put("totalTasks", totalTasks);
        stats.put("totalNotes", totalNotes);
        stats.put("totalNotices", totalNotices);
        stats.put("placementStrong", strongCount);
        stats.put("placementModerate", moderateCount);
        stats.put("placementNeedsPrep", needsPrepCount);
        stats.put("averagePlacementScore", placementList.isEmpty() ? 0 :
            (int) placementList.stream().mapToInt(StudentPlacementDto::getReadinessScore).average().orElse(0));
        return stats;
    }

    public List<StudentPlacementDto> getPlacementAnalysis(String deptFilter, String catFilter) {
        List<User> students = userRepository.findByRole(User.Role.STUDENT);

        List<StudentPlacementDto> list = new ArrayList<>();
        for (User student : students) {
            if (deptFilter != null && !deptFilter.isBlank() && !deptFilter.equalsIgnoreCase("ALL")
                && student.getDepartment() != null && !student.getDepartment().equalsIgnoreCase(deptFilter)) {
                continue;
            }

            List<Document> docs = documentRepository.findByUserId(student.getId());
            List<Task> tasks = taskRepository.findByUserId(student.getId());
            List<Note> notes = noteRepository.findByUserId(student.getId());
            long completedTasks = tasks.stream().filter(t -> t.getStatus() == Task.Status.COMPLETED).count();

            // Check if resume or cv uploaded
            boolean hasResume = docs.stream().anyMatch(d -> {
                String title = (d.getTitle() + " " + (d.getFileUrl() != null ? d.getFileUrl() : "")).toLowerCase();
                return title.contains("resume") || title.contains("cv") || title.contains("profile");
            });

            // Calculate Placement Readiness Score
            int score = 0;
            // 1. Resume factor (35 pts)
            if (hasResume) {
                score += 35;
            } else if (!docs.isEmpty()) {
                score += 15;
            }

            // 2. Study & Tech Notes factor (25 pts)
            if (notes.size() >= 4) {
                score += 25;
            } else if (notes.size() >= 2) {
                score += 18;
            } else if (notes.size() == 1) {
                score += 10;
            }

            // 3. Task Completion factor (25 pts)
            if (completedTasks >= 3) {
                score += 25;
            } else if (completedTasks >= 1) {
                score += 15;
            } else if (!tasks.isEmpty()) {
                score += 8;
            }

            // 4. Document library & project depth (15 pts)
            if (docs.size() >= 3) {
                score += 15;
            } else if (docs.size() >= 1) {
                score += 10;
            }

            // Fallback base for active student
            if (score < 30 && (!notes.isEmpty() || !tasks.isEmpty() || !docs.isEmpty())) {
                score = 42;
            }
            if (score > 100) score = 100;

            // Placement Category
            String category;
            if (score >= 70) {
                category = "STRONG";
            } else if (score >= 45) {
                category = "MODERATE";
            } else {
                category = "NEEDS_PREPARATION";
            }

            if (catFilter != null && !catFilter.isBlank() && !catFilter.equalsIgnoreCase("ALL")
                && !category.equalsIgnoreCase(catFilter)) {
                continue;
            }

            // Top skills based on docs/notes
            List<String> skills = new ArrayList<>();
            skills.add("Data Structures");
            skills.add("Core Java");
            if (hasResume || docs.size() >= 2) skills.add("System Design");
            if (notes.size() >= 2) skills.add("SQL & DBMS");
            if (completedTasks >= 2) skills.add("Spring Boot / REST");

            StudentPlacementDto dto = StudentPlacementDto.builder()
                .id(student.getId())
                .name(student.getName())
                .email(student.getEmail())
                .department(student.getDepartment() != null ? student.getDepartment() : "Computer Science & Engineering")
                .rollNumber(student.getRollNumber() != null ? student.getRollNumber() : "CS2026-" + student.getId())
                .cgpa(student.getCgpa() != null ? student.getCgpa() : 8.4)
                .readinessScore(score)
                .category(category)
                .documentsCount(docs.size())
                .tasksCompletedCount((int) completedTasks)
                .notesCount(notes.size())
                .totalActivities(docs.size() + tasks.size() + notes.size())
                .hasResume(hasResume)
                .topSkills(skills)
                .build();

            list.add(dto);
        }

        // Sort: Strongest placement candidates first
        list.sort((a, b) -> Integer.compare(b.getReadinessScore(), a.getReadinessScore()));
        return list;
    }

    public List<Map<String, Object>> getAllUsers() {
        return userRepository.findAll().stream().map(u -> {
            Map<String, Object> map = new HashMap<>();
            map.put("id", u.getId());
            map.put("name", u.getName());
            map.put("email", u.getEmail());
            map.put("role", u.getRole().name());
            map.put("department", u.getDepartment() != null ? u.getDepartment() : "General");
            map.put("createdAt", u.getCreatedAt());
            map.put("collegeName", u.getCollege() != null ? u.getCollege().getName() : "College Campus");
            return map;
        }).collect(Collectors.toList());
    }

    public void updateUserRole(Long userId, String newRole, User admin) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new RuntimeException("User not found: " + userId));
        User.Role role = User.Role.valueOf(newRole.toUpperCase());
        user.setRole(role);
        userRepository.save(user);

        activityService.logActivity(admin, "ROLE_CHANGE",
            "Changed role of " + user.getEmail() + " to " + role.name());
    }
}
