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
     * Forward the uploaded MultipartFile to FastAPI /ingest endpoint.
     * Returns number of chunks created, or -1 on failure.
     */
    public int ingestDocument(MultipartFile file, Long userId) {
        return ingestDocument(file, userId, null);
    }

    public int ingestDocument(MultipartFile file, Long userId, Long documentId) {
        try {
            byte[] fileBytes = file.getBytes();

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.MULTIPART_FORM_DATA);
            if (ragApiKey != null && !ragApiKey.isBlank()) {
                headers.set("X-RAG-API-Key", ragApiKey);
            }

            MultiValueMap<String, Object> body = new LinkedMultiValueMap<>();

            // Wrap bytes in a named resource so FastAPI receives a proper file
            ByteArrayResource fileResource = new ByteArrayResource(fileBytes) {
                @Override
                public String getFilename() {
                    return file.getOriginalFilename();
                }
            };

            body.add("file", fileResource);
            if (userId != null)    body.add("user_id", userId.toString());
            if (documentId != null) body.add("document_id", documentId.toString());

            HttpEntity<MultiValueMap<String, Object>> requestEntity = new HttpEntity<>(body, headers);

            ResponseEntity<Map> response = restTemplate.postForEntity(
                ragBaseUrl + "/ingest", requestEntity, Map.class);

            if (response.getStatusCode() == HttpStatus.OK && response.getBody() != null) {
                Map<String, Object> resp = response.getBody();
                Boolean success = (Boolean) resp.getOrDefault("success", false);
                if (Boolean.TRUE.equals(success)) {
                    int chunks = (int) resp.getOrDefault("chunks_created", 0);
                    log.info("Ingested {} chunks for document '{}' (user {})", chunks, file.getOriginalFilename(), userId);
                    return chunks;
                } else {
                    log.warn("RAG ingest returned success=false: {}", resp.get("message"));
                    return 0;
                }
            }
        } catch (Exception e) {
            log.error("Ingest error for file '{}': {}", file.getOriginalFilename(), e.getMessage());
        }
        return -1;
    }

    /** Check if FastAPI RAG service is reachable */
    public String getStatus() {
        try {
            ResponseEntity<Map> response = restTemplate.getForEntity(ragBaseUrl + "/health", Map.class);
            return response.getStatusCode().is2xxSuccessful() ? "ONLINE" : "DEGRADED";
        } catch (Exception e) {
            return "OFFLINE";
        }
    }
}
