package com.aiworkplace.controller;

import com.aiworkplace.dto.response.DocumentResponse;
import com.aiworkplace.entity.User;
import com.aiworkplace.service.AuthService;
import com.aiworkplace.service.DocumentService;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/documents")
@RequiredArgsConstructor
public class DocumentController {

    private final DocumentService documentService;
    private final AuthService authService;

    /** Get all personal documents for the logged-in user */
    @GetMapping
    public ResponseEntity<List<DocumentResponse>> getDocuments(
            @AuthenticationPrincipal UserDetails userDetails) {
        User user = authService.getCurrentUser(userDetails.getUsername());
        return ResponseEntity.ok(documentService.getDocumentsByUser(user.getId()));
    }

    /** Upload a personal document → saves to disk + RAG ingest */
    @PostMapping("/upload")
    public ResponseEntity<DocumentResponse> upload(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestParam("file") MultipartFile file) throws Exception {
        User user = authService.getCurrentUser(userDetails.getUsername());
        return ResponseEntity.ok(documentService.uploadDocument(user, file));
    }

    /** Admin: Upload a college document (shared with all) */
    @PostMapping("/upload/college")
    public ResponseEntity<DocumentResponse> uploadCollege(
            @AuthenticationPrincipal UserDetails userDetails,
            @RequestParam("file") MultipartFile file) throws Exception {
        User user = authService.getCurrentUser(userDetails.getUsername());
        return ResponseEntity.ok(documentService.uploadCollegeDocument(user, file));
    }

    /** Get all college documents (public to all authenticated users) */
    @GetMapping("/college")
    public ResponseEntity<List<DocumentResponse>> getCollegeDocuments() {
        return ResponseEntity.ok(documentService.getCollegeDocuments());
    }

    @GetMapping("/{id}")
    public ResponseEntity<DocumentResponse> getDocument(@PathVariable Long id) {
        return ResponseEntity.ok(documentService.getDocumentById(id));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteDocument(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long id) {
        User user = authService.getCurrentUser(userDetails.getUsername());
        documentService.deleteDocument(id, user.getId());
        return ResponseEntity.noContent().build();
    }
}
