package com.aiworkplace.service;

import com.aiworkplace.dto.response.DocumentResponse;
import com.aiworkplace.entity.Document;
import com.aiworkplace.entity.User;
import com.aiworkplace.repository.DocumentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.*;
import java.util.List;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class DocumentService {

    private final DocumentRepository documentRepository;
    private final AIClientService aiClientService;

    @Value("${app.upload.dir}")
    private String uploadDir;

    /**
     * Upload document: save file to disk → save DB record → forward to RAG for ingestion.
     */
    public DocumentResponse uploadDocument(User user, MultipartFile file) throws IOException {
        // 1. Save file to disk
        Path uploadPath = Paths.get(uploadDir).toAbsolutePath().normalize();
        Files.createDirectories(uploadPath);
        String fileName = UUID.randomUUID() + "_" + file.getOriginalFilename();
        Path filePath = uploadPath.resolve(fileName);
        Files.copy(file.getInputStream(), filePath, StandardCopyOption.REPLACE_EXISTING);

        // 2. Save Document record to DB
        Document doc = Document.builder()
            .title(file.getOriginalFilename())
            .fileUrl("/uploads/" + fileName)
            .fileType(file.getContentType())
            .fileSize(file.getSize())
            .user(user)
            .isCollegeDoc(false)
            .build();
        doc = documentRepository.save(doc);

        // 3. Ingest into RAG (FastAPI) — send the original MultipartFile
        int chunks = aiClientService.ingestDocument(file, user.getId(), doc.getId());
        if (chunks < 0) {
            log.warn("RAG ingest failed for doc id={}, proceeding without vector index.", doc.getId());
        } else {
            log.info("RAG ingested {} chunks for doc id={}", chunks, doc.getId());
        }

        return toResponse(doc);
    }

    /**
     * Admin: Upload a college document (shared with all users of that college).
     */
    public DocumentResponse uploadCollegeDocument(User admin, MultipartFile file) throws IOException {
        // 1. Save file to disk
        Path uploadPath = Paths.get(uploadDir).toAbsolutePath().normalize();
        Files.createDirectories(uploadPath);
        String fileName = UUID.randomUUID() + "_" + file.getOriginalFilename();
        Path filePath = uploadPath.resolve(fileName);
        Files.copy(file.getInputStream(), filePath, StandardCopyOption.REPLACE_EXISTING);

        // 2. Save Document record (isCollegeDoc = true)
        Document doc = Document.builder()
            .title(file.getOriginalFilename())
            .fileUrl("/uploads/" + fileName)
            .fileType(file.getContentType())
            .fileSize(file.getSize())
            .user(admin)
            .isCollegeDoc(true)
            .build();
        doc = documentRepository.save(doc);

        // 3. Ingest into RAG
        int chunks = aiClientService.ingestDocument(file, admin.getId(), doc.getId());
        log.info("College doc ingested: {} chunks for doc id={}", chunks, doc.getId());

        return toResponse(doc);
    }

    public List<DocumentResponse> getDocumentsByUser(Long userId) {
        return documentRepository.findByUserId(userId).stream().map(this::toResponse).toList();
    }

    public List<DocumentResponse> getCollegeDocuments() {
        return documentRepository.findByIsCollegeDocTrue().stream().map(this::toResponse).toList();
    }

    public DocumentResponse getDocumentById(Long id) {
        return toResponse(documentRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Document not found: " + id)));
    }

    public void deleteDocument(Long id, Long userId) {
        Document doc = documentRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Document not found"));
        if (!doc.getUser().getId().equals(userId)) throw new RuntimeException("Unauthorized");
        documentRepository.delete(doc);
    }

    private DocumentResponse toResponse(Document d) {
        return DocumentResponse.builder()
            .id(d.getId())
            .title(d.getTitle())
            .fileName(d.getTitle())
            .fileUrl(d.getFileUrl())
            .fileType(d.getFileType())
            .fileSize(d.getFileSize())
            .uploadedAt(d.getUploadedAt())
            .isCollegeDoc(d.isCollegeDoc())
            .build();
    }
}
