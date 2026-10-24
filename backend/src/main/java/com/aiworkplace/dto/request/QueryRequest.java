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
    // Recent chat turns used to resolve follow-ups. Each item contains role/content
    // and an optional clarification_needed flag for assistant turns.
    private List<Map<String, Object>> conversationHistory = new ArrayList<>();
}
