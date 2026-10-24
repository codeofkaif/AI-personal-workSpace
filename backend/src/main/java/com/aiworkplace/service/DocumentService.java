package com.aiworkplace.service;

import com.aiworkplace.dto.response.DocumentResponse;
import com.aiworkplace.entity.Document;
import com.aiworkplace.entity.User;
import com.aiworkplace.repository.DocumentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;

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

        // 3. An upload is successful only when it is searchable immediately.
        return requireIndexed(file, user, doc, filePath);
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
            .college(admin.getCollege())
            .isCollegeDoc(true)
            .build();
        doc = documentRepository.save(doc);

        // 3. Publish shared documents only after their index is complete.
        return requireIndexed(file, admin, doc, filePath);
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
        // Purge chunks first so a failed RAG deletion does not leave the index inconsistent.
        if (!aiClientService.deleteDocumentChunks(id, userId)) {
            throw new IllegalStateException(
                "Document index could not be deleted. Please retry when the AI service is available."
            );
        }
        documentRepository.delete(doc);
    }

    private DocumentResponse requireIndexed(MultipartFile file, User owner, Document doc, Path filePath) {
        int chunks = aiClientService.ingestDocument(file, owner.getId(), doc.getId());
        if (chunks > 0) {
            log.info("RAG indexed {} chunks for document id={}", chunks, doc.getId());
            return toResponse(doc);
        }

        cleanupFailedUpload(doc, filePath);
        String detail = chunks == 0
            ? "No readable text could be indexed. This is usually a scanned/image-only PDF; install OCR or upload a text-based PDF, DOCX, TXT, or MD file."
            : "The RAG indexing service is unavailable. The document was not saved; retry after RAG is healthy.";
        throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, detail);
    }

    private void cleanupFailedUpload(Document doc, Path filePath) {
        try {
            documentRepository.deleteById(doc.getId());
        } catch (RuntimeException e) {
            log.error("Could not remove unindexed document record id={}", doc.getId(), e);
        }
        try {
            Files.deleteIfExists(filePath);
        } catch (IOException e) {
            log.error("Could not remove unindexed upload {}", filePath, e);
        }
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
