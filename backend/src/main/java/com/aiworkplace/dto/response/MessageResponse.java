package com.aiworkplace.dto.response;
import lombok.*;
import java.time.LocalDateTime;
@Data @Builder @AllArgsConstructor @NoArgsConstructor
public class MessageResponse {
    private Long id;
    private String content;
    private String sender;
    private LocalDateTime createdAt;
}
