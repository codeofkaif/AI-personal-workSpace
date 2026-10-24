package com.aiworkplace.dto.response;
import lombok.*;
import java.time.LocalDateTime;
@Data @Builder @AllArgsConstructor @NoArgsConstructor
public class DocumentResponse {
    private Long id;
    private String title;
    private String fileName;
    private String fileUrl;
    private String fileType;
    private Long fileSize;
    private LocalDateTime uploadedAt;
    private boolean isCollegeDoc;
}
