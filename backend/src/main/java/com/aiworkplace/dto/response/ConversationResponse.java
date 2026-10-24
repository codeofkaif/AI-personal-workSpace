package com.aiworkplace.dto.response;
import lombok.*;
import java.time.LocalDateTime;
import java.util.List;
@Data @Builder @AllArgsConstructor @NoArgsConstructor
public class ConversationResponse {
    private Long id;
    private LocalDateTime createdAt;
    private List<MessageResponse> messages;
}
