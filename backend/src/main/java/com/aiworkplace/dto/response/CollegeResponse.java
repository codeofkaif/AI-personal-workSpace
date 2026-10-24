package com.aiworkplace.dto.response;
import lombok.*;
import java.time.LocalDateTime;
@Data @Builder @AllArgsConstructor @NoArgsConstructor
public class CollegeResponse {
    private Long id;
    private String name;
    private String code;
    private String description;
    private LocalDateTime createdAt;
}
