package com.aiworkplace.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import java.time.LocalDateTime;

@Entity
@Table(name = "notices")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Notice {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String title;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String content;

    @Column(nullable = false)
    private String category; // e.g. "Exam", "Placement", "Workshop", "General", "Urgent"

    @Column(nullable = false)
    private String targetAudience; // "ALL", "CSE", "IT", "ECE", "MECH"

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private User.Role publishedByRole; // ADMIN, DEAN, HOD

    @Column(nullable = false)
    private String publishedByName;

    @Column(nullable = false)
    private String priority; // "HIGH", "MEDIUM", "LOW", "URGENT"

    @CreationTimestamp
    private LocalDateTime createdAt;
}
