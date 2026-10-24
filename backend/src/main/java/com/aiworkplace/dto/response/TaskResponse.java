package com.aiworkplace.dto.response;
import lombok.*;
import java.time.LocalDate;
import java.time.LocalDateTime;
@Data @Builder @AllArgsConstructor @NoArgsConstructor
public class TaskResponse {
    private Long id;
    private String title;
    private String description;
    private String status;
    private LocalDate dueDate;
    private LocalDateTime createdAt;
}
