package com.aiworkplace.dto.request;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;
@Data
public class MessageRequest {
    @NotBlank private String content;
}
