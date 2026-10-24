package com.aiworkplace.dto.request;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
@Data
public class QueryRequest {
    @NotBlank private String question;
    private Integer topK = 5;
    private String scope;
    // Last user/assistant turns support referential follow-ups and clarification replies.
    private List<Map<String, Object>> conversationHistory = new ArrayList<>();
}
