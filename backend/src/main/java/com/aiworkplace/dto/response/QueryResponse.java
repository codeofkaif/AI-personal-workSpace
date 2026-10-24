package com.aiworkplace.dto.response;
import lombok.*;
import java.util.List;
@Data @Builder @AllArgsConstructor @NoArgsConstructor
public class QueryResponse {
    private String answer;
    private List<String> sources;
    private String conversationId;
    private boolean clarificationNeeded;
}
