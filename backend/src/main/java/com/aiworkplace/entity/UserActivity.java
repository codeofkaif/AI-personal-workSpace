package com.aiworkplace.entity;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import java.time.LocalDateTime;

@Entity
@Table(name = "user_activities")
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UserActivity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private Long userId;

    private String userName;

    private String userEmail;

    private String userRole;

    private String action; // "LOGIN", "DOCUMENT_UPLOAD", "AI_CHAT", "NOTE_CREATE", "TASK_COMPLETE", "NOTICE_POST", "PROFILE_UPDATE"

    @Column(columnDefinition = "TEXT")
    private String details;

    @CreationTimestamp
    private LocalDateTime timestamp;
}
