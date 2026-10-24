package com.aiworkplace.dto.response;

import lombok.Builder;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Builder
public class NoticeResponse {
    private Long id;
    private String title;
    private String content;
    private String category;
    private String targetAudience;
    private String publishedByRole;
    private String publishedByName;
    private String priority;
    private LocalDateTime createdAt;
}
