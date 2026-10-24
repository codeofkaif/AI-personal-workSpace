package com.aiworkplace.service;

import com.aiworkplace.dto.request.QueryRequest;
import com.aiworkplace.dto.response.QueryResponse;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.http.*;
import org.springframework.stereotype.Service;
import org.springframework.util.LinkedMultiValueMap;
import org.springframework.util.MultiValueMap;
import org.springframework.web.client.RestTemplate;
import org.springframework.web.client.HttpStatusCodeException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.web.multipart.MultipartFile;

import com.aiworkplace.entity.User;

import java.util.*;

@Service
@RequiredArgsConstructor
@Slf4j
public class AIClientService {

    @Value("${app.rag.base-url}")
    private String ragBaseUrl;

    @Value("${app.rag.api-key:}")
    private String ragApiKey;

    private final RestTemplate restTemplate;

    /** Send question to RAG /query endpoint with full user identity profile */
    public QueryResponse queryAI(QueryRequest req, User user) {
        try {
            Map<String, Object> body = new HashMap<>();
            body.put("question", req.getQuestion());
            body.put("user_id", user != null ? user.getId() : null);
            body.put("top_k", req.getTopK() != null ? req.getTopK() : 5);
            body.put("conversation_history",
                req.getConversationHistory() != null ? req.getConversationHistory() : List.of());
            if (req.getScope() != null) {
                body.put("scope", req.getScope());
            }

            if (user != null) {
                Map<String, Object> profile = new HashMap<>();
                profile.put("id", user.getId());
                profile.put("name", user.getName());
                profile.put("email", user.getEmail());
                profile.put("role", user.getRole().name());
                if (user.getDepartment() != null && !user.getDepartment().isBlank()) {
                    profile.put("department", user.getDepartment());
                }
                if (user.getRollNumber() != null && !user.getRollNumber().isBlank()) {
                    profile.put("roll_number", user.getRollNumber());
                }
                if (user.getCgpa() != null) {
                    profile.put("cgpa", user.getCgpa());
                }
                if (user.getCollege() != null && user.getCollege().getName() != null) {
                    profile.put("college", user.getCollege().getName());
                }
                body.put("user_profile", profile);
            }

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            if (ragApiKey != null && !ragApiKey.isBlank()) {
                headers.set("X-RAG-API-Key", ragApiKey);
            }
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(body, headers);

            ResponseEntity<Map> response = restTemplate.postForEntity(
                ragBaseUrl + "/query", entity, Map.class);

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                Map<String, Object> resp = response.getBody();
                return QueryResponse.builder()
                    .answer((String) resp.getOrDefault("answer", "No answer found"))
                    .sources((List<String>) resp.getOrDefault("sources", List.of()))
                    .clarificationNeeded(Boolean.TRUE.equals(resp.get("clarification_needed")))
                    .build();
            }
        } catch (Exception e) {
            log.error("AI service query error: {}", e.getMessage());
        }
        return QueryResponse.builder()
            .answer("AI service is currently unavailable. Please ensure the RAG service is running on port 8000.")
            .sources(List.of()).build();
    }

    public QueryResponse queryAI(QueryRequest req, Long userId) {
        User dummy = User.builder().id(userId).role(User.Role.STUDENT).name("Student").build();
        return queryAI(req, dummy);
    }

    /**
     * Result of the synchronous upload -> extraction -> chunking -> embedding -> DB commit.
     * A document is searchable only when indexed=true and chunksCreated is positive.
     */
    public record IngestionResult(int chunksCreated, int httpStatus, String message) {
        public boolean indexed() {
            return httpStatus >= 200 && httpStatus < 300 && chunksCreated > 0;
        }
    }

    public int ingestDocument(MultipartFile file, Long userId) {
        return ingestDocument(file, userId, null);
    }

    /** Compatibility wrapper for callers that only need a chunk count. */
    public int ingestDocument(MultipartFile file, Long userId, Long documentId) {
        IngestionResult result = ingestDocumentResult(file, userId, documentId);
        if (result.indexed()) return result.chunksCreated();
        return result.httpStatus() == 422 ? 0 : -1;
    }

    public IngestionResult ingestDocumentResult(MultipartFile file, Long userId, Long documentId) {
        try {
            byte[] fileBytes = file.getBytes();

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.MULTIPART_FORM_DATA);
            if (ragApiKey != null && !ragApiKey.isBlank()) {
                headers.set("X-RAG-API-Key", ragApiKey);
            }

            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();
            ByteArrayResource fileResource = new ByteArrayResource(fileBytes) {
                @Override
                public String getFilename() {
                    return file.getOriginalFilename();
                }
            };
            body.add("file", fileResource);
            if (userId != null) body.add("user_id", userId.toString());
            if (documentId != null) body.add("document_id", documentId.toString());

            HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);
            ResponseEntity<Map> response = restTemplate.postForEntity(
                ragBaseUrl + "/ingest", requestEntity, Map.class);

            if (response.getStatusCode().is2xxSuccessful() && response.getBody() != null) {
                Map<String, Object> resp = response.getBody();
                boolean success = Boolean.TRUE.equals(resp.get("success"));
                Object rawChunks = resp.get("chunks_created");
                int chunks = rawChunks instanceof Number number ? number.intValue() : 0;
                String message = String.valueOf(resp.getOrDefault("message", ""));
                if (success && chunks > 0) {
                    log.info("Indexed {} chunks for document '{}' (user {})",
                        chunks, file.getOriginalFilename(), userId);
                    return new IngestionResult(chunks, response.getStatusCode().value(), message);
                }
                log.warn("RAG did not index file '{}': {}", file.getOriginalFilename(), message);
                return new IngestionResult(0, 422, message.isBlank()
                    ? "RAG returned success=false or zero searchable chunks." : message);
            }
            return new IngestionResult(0, response.getStatusCode().value(),
                "RAG returned an unexpected response without a confirmed index.");

        } catch (HttpStatusCodeException e) {
            int status = e.getStatusCode().value();
            String details = extractRagError(e.getResponseBodyAsString());
            log.warn("RAG ingestion HTTP {} for '{}': {}", status, file.getOriginalFilename(), details);
            return new IngestionResult(status == 422 ? 0 : -1, status, details);
        } catch (Exception e) {
            log.error("RAG ingestion failed for '{}': {}", file.getOriginalFilename(), e.getMessage());
            return new IngestionResult(-1, 503,
                "RAG service could not confirm indexing. Check service health, shared RAG_API_KEY, and logs.");
        }
    }

    private String extractRagError(String responseBody) {
        if (responseBody == null || responseBody.isBlank()) {
            return "RAG request failed without an error body.";
        }
        try {
            JsonNode root = new ObjectMapper().readTree(responseBody);
            for (String key : List.of("detail", "message", "error")) {
                String value = root.path(key).asText("");
                if (!value.isBlank()) return value;
            }
        } catch (Exception ignored) {
            // Keep a bounded response body when the RAG service did not return JSON.
        }
        return responseBody.length() > 500 ? responseBody.substring(0, 500) : responseBody;
    }

    /**
     * Remove vectors for an owned document before deleting its relational record.
     * The RAG service verifies ownership independently; the shared service key never reaches the browser.
     */
    public boolean deleteDocumentChunks(Long documentId, Long userId) {
        if (documentId == null || userId == null) {
            return false;
        }
        try {
            HttpHeaders headers = new HttpHeaders();
            if (ragApiKey != null && !ragApiKey.isBlank()) {
                headers.set("X-RAG-API-Key", ragApiKey);
            }
            HttpEntity<Void> request = new HttpEntity<>(headers);
            String url = ragBaseUrl + "/documents/" + documentId + "?user_id=" + userId;
            ResponseEntity<Map> response = restTemplate.exchange(
                url, HttpMethod.DELETE, request, Map.class);
            return response.getStatusCode().is2xxSuccessful()
                && response.getBody() != null
                && Boolean.TRUE.equals(response.getBody().get("success"));
        } catch (Exception e) {
            log.warn("Could not purge RAG chunks for document {} (user {}): {}", documentId, userId, e.getMessage());
            return false;
        }
    }

    /** Check if FastAPI RAG service is reachable */
    public String getStatus() {
        try {
            ResponseEntity<Map> response = restTemplate.getForEntity(ragBaseUrl + "/health", Map.class);
            if (!response.getStatusCode().is2xxSuccessful() || response.getBody() == null) {
                return "DEGRADED";
            }
            Object status = response.getBody().get("status");
            return "healthy".equalsIgnoreCase(String.valueOf(status)) ? "ONLINE" : "DEGRADED";
        } catch (Exception e) {
            return "OFFLINE";
        }
    }
}
