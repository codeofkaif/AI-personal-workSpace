package com.aiworkplace.controller;

import com.aiworkplace.service.AIClientService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/health")
@RequiredArgsConstructor
public class HealthController {

    private final JdbcTemplate jdbcTemplate;
    private final AIClientService aiClientService;

    @GetMapping
    public ResponseEntity<Map<String, Object>> checkHealth() {
        Map<String, Object> health = new LinkedHashMap<>();
        health.put("status", "UP");
        health.put("timestamp", Instant.now().toString());

        // 1. Check PostgreSQL Database
        try {
            jdbcTemplate.queryForObject("SELECT 1", Integer.class);
            health.put("database", Map.of("status", "UP", "message", "PostgreSQL connected"));
        } catch (Exception e) {
            health.put("database", Map.of("status", "DOWN", "error", e.getMessage()));
            health.put("status", "DEGRADED");
        }

        // 2. Check RAG Service (FastAPI)
        try {
            String ragStatus = aiClientService.getStatus();
            health.put("ragService", Map.of("status", "online".equalsIgnoreCase(ragStatus) ? "UP" : "DOWN", "detail", ragStatus));
        } catch (Exception e) {
            health.put("ragService", Map.of("status", "DOWN", "error", e.getMessage()));
        }

        return ResponseEntity.ok(health);
    }
}
