package com.aiworkplace.controller;

import com.aiworkplace.dto.request.QueryRequest;
import com.aiworkplace.dto.response.*;
import com.aiworkplace.entity.User;
import com.aiworkplace.service.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import java.util.Map;

@RestController
@RequestMapping("/api/ai")
@RequiredArgsConstructor
public class AIController {

    private final AIClientService aiClientService;
    private final AuthService authService;
    private final ConversationService conversationService;

    @PostMapping("/chat")
    public ResponseEntity<QueryResponse> chat(@AuthenticationPrincipal UserDetails userDetails,
                                               @Valid @RequestBody QueryRequest req) {
        User user = authService.getCurrentUser(userDetails.getUsername());
        // Save user message to conversation
        QueryResponse aiResp = aiClientService.queryAI(req, user);
        return ResponseEntity.ok(aiResp);
    }

    @PostMapping("/ingest")
    public ResponseEntity<Map<String, Object>> ingest(@AuthenticationPrincipal UserDetails userDetails,
                                                       @RequestParam("file") MultipartFile file) {
        User user = authService.getCurrentUser(userDetails.getUsername());
        int chunks = aiClientService.ingestDocument(file, user.getId());
        return ResponseEntity.ok(Map.of("success", chunks >= 0, "chunks", chunks, "file", file.getOriginalFilename()));
    }

    @GetMapping("/status")
    public ResponseEntity<Map<String, String>> status() {
        return ResponseEntity.ok(Map.of("rag_service", aiClientService.getStatus()));
    }
}
