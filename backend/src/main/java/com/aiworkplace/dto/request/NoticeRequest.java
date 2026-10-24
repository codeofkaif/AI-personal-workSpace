package com.aiworkplace.dto.request;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class NoticeRequest {
    @NotBlank
    private String title;

    @NotBlank
    private String content;

    private String category = "General";

    private String targetAudience = "ALL";

    private String priority = "MEDIUM";
}
