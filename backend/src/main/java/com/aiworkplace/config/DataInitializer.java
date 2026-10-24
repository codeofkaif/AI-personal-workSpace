package com.aiworkplace.config;

import com.aiworkplace.entity.*;
import com.aiworkplace.repository.*;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
@RequiredArgsConstructor
@Slf4j
public class DataInitializer implements CommandLineRunner {

    private final UserRepository userRepository;
    private final CollegeRepository collegeRepository;
    private final NoticeRepository noticeRepository;
    private final UserActivityRepository activityRepository;
    private final PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) throws Exception {
        // Ensure default college exists
        College college = collegeRepository.findByCode("BBDU").orElseGet(() -> {
            College c = College.builder()
                .name("Babu Banarasi Das University")
                .code("BBDU")
                .description("Lucknow Campus")
                .build();
            return collegeRepository.save(c);
        });

        // 1. Ensure College Admin exists
        User admin = userRepository.findByEmail("admin@college.edu").orElse(null);
        if (admin == null) {
            admin = User.builder()
                .name("Super Admin")
                .email("admin@college.edu")
                .password(passwordEncoder.encode("password123"))
                .role(User.Role.COLLEGE_ADMIN)
                .college(college)
                .department("Administration")
                .build();
            userRepository.save(admin);
            log.info("Initialized College Admin user");
        } else if (admin.getRole() != User.Role.COLLEGE_ADMIN && admin.getRole() != User.Role.ADMIN) {
            admin.setRole(User.Role.COLLEGE_ADMIN);
            userRepository.save(admin);
        }

        // 2. Ensure Dean exists
        User dean = userRepository.findByEmail("dean@college.edu").orElse(null);
        if (dean == null) {
            dean = User.builder()
                .name("Dr. Alok Verma (Dean)")
                .email("dean@college.edu")
                .password(passwordEncoder.encode("password123"))
                .role(User.Role.DEAN)
                .college(college)
                .department("Academic Affairs")
                .build();
            userRepository.save(dean);
            log.info("Initialized Dean user");
        }

        // 3. Ensure HOD exists
        User hod = userRepository.findByEmail("hod.cse@college.edu").orElse(null);
        if (hod == null) {
            hod = User.builder()
                .name("Dr. S. K. Gupta (HOD CSE)")
                .email("hod.cse@college.edu")
                .password(passwordEncoder.encode("password123"))
                .role(User.Role.HOD)
                .college(college)
                .department("Computer Science & Engineering")
                .build();
            userRepository.save(hod);
            log.info("Initialized HOD CSE user");
        }

        // 4. Ensure Student Kaif Khan has department and roll number
        userRepository.findByEmail("kaif@test.com").ifPresent(k -> {
            if (k.getDepartment() == null || k.getRollNumber() == null) {
                k.setDepartment("Computer Science & Engineering");
                k.setRollNumber("CS2026-001");
                k.setCgpa(8.9);
                userRepository.save(k);
            }
        });

        // 5. Seed peer students for Placement Strong Category demonstration
        if (userRepository.findByEmail("rahul.sharma@student.bbd.edu.in").isEmpty()) {
            User s2 = User.builder()
                .name("Rahul Sharma")
                .email("rahul.sharma@student.bbd.edu.in")
                .password(passwordEncoder.encode("password123"))
                .role(User.Role.STUDENT)
                .college(college)
                .department("Computer Science & Engineering")
                .rollNumber("CS2026-042")
                .cgpa(8.2)
                .build();
            userRepository.save(s2);
        }

        if (userRepository.findByEmail("priya.singh@student.bbd.edu.in").isEmpty()) {
            User s3 = User.builder()
                .name("Priya Singh")
                .email("priya.singh@student.bbd.edu.in")
                .password(passwordEncoder.encode("password123"))
                .role(User.Role.STUDENT)
                .college(college)
                .department("Information Technology")
                .rollNumber("IT2026-018")
                .cgpa(7.5)
                .build();
            userRepository.save(s3);
        }

        if (userRepository.findByEmail("aman.verma@student.bbd.edu.in").isEmpty()) {
            User s4 = User.builder()
                .name("Aman Verma")
                .email("aman.verma@student.bbd.edu.in")
                .password(passwordEncoder.encode("password123"))
                .role(User.Role.STUDENT)
                .college(college)
                .department("Electronics & Comm.")
                .rollNumber("EC2026-095")
                .cgpa(6.8)
                .build();
            userRepository.save(s4);
        }

        // 6. Seed Hierarchical Notices if empty
        if (noticeRepository.count() == 0) {
            noticeRepository.save(Notice.builder()
                .title("Campus Placement Season 2026-27: Registration & Drive Schedule")
                .content("Official registration for Tier-1 technology campus drives (TCS, Infosys, Amazon, Cognizant) is now live. Ensure updated resume is uploaded in your workspace.")
                .category("Placement")
                .targetAudience("ALL")
                .publishedByRole(User.Role.ADMIN)
                .publishedByName("Super Admin")
                .priority("URGENT")
                .build());

            noticeRepository.save(Notice.builder()
                .title("Dean's Academic Directive: Minimum 75% Attendance & Mid-Term Guidelines")
                .content("In accordance with University Academic Senate resolutions, strict 75% minimum classroom attendance is compulsory for semester exam admit card eligibility.")
                .category("Academic")
                .targetAudience("ALL")
                .publishedByRole(User.Role.DEAN)
                .publishedByName("Dr. Alok Verma (Dean)")
                .priority("HIGH")
                .build());

            noticeRepository.save(Notice.builder()
                .title("CSE Department: Final Year Capstone Project Milestone-1 Review")
                .content("All 7th and 8th semester Computer Science project groups must submit their System Architecture and SRS document by Friday 5:00 PM to the department portal.")
                .category("Workshop")
                .targetAudience("Computer Science & Engineering")
                .publishedByRole(User.Role.HOD)
                .publishedByName("Dr. S. K. Gupta (HOD CSE)")
                .priority("HIGH")
                .build());
        }

        // 7. Seed sample audit activity if empty
        if (activityRepository.count() == 0) {
            activityRepository.save(UserActivity.builder()
                .userName("Kaif Khan")
                .userEmail("kaif@test.com")
                .userRole("STUDENT")
                .action("DOCUMENT_UPLOAD")
                .details("Uploaded Md_Kaif_Ali_Resume---02.pdf (135 KB) to study vault")
                .build());

            activityRepository.save(UserActivity.builder()
                .userName("Kaif Khan")
                .userEmail("kaif@test.com")
                .userRole("STUDENT")
                .action("AI_CHAT")
                .details("Queried AI: 'Tell me about Kaif Khan experience from resume'")
                .build());

            activityRepository.save(UserActivity.builder()
                .userName("Dr. Alok Verma (Dean)")
                .userEmail("dean@college.edu")
                .userRole("DEAN")
                .action("NOTICE_PUBLISH")
                .details("Issued Academic Directive on Attendance to all colleges")
                .build());
        }
    }
}
