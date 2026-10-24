package com.aiworkplace.dto.request;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;
@Data
public class QueryRequest {
    @NotBlank private String question;
    private Integer topK = 5;
    private String scope;
}
