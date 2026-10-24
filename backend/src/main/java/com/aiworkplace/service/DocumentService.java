package com.aiworkplace.service;

import com.aiworkplace.dto.response.DocumentResponse;
import com.aiworkplace.entity.Document;
import com.aiworkplace.entity.User;
import com.aiworkplace.repository.DocumentRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;
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

        // 3. The upload is not complete until RAG confirms that searchable chunks exist.
        AIClientService.IngestionResult ingestion =
            aiClientService.ingestDocumentResult(file, user.getId(), doc.getId());
        if (!ingestion.indexed()) {
            rollbackFailedUpload(doc, filePath, user.getId());
            throw indexingFailure(file.getOriginalFilename(), ingestion);
        }
        log.info("RAG ingested {} chunks for doc id={}", ingestion.chunksCreated(), doc.getId());
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
            .college(admin.getCollege())
            .isCollegeDoc(true)
            .build();
        doc = documentRepository.save(doc);

        // 3. The upload is not complete until RAG confirms that searchable chunks exist.
        AIClientService.IngestionResult ingestion =
            aiClientService.ingestDocumentResult(file, admin.getId(), doc.getId());
        if (!ingestion.indexed()) {
            rollbackFailedUpload(doc, filePath, admin.getId());
            throw indexingFailure(file.getOriginalFilename(), ingestion);
        }
        log.info("College doc ingested: {} chunks for doc id={}", ingestion.chunksCreated(), doc.getId());
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
        // Purge chunks first so a failed RAG deletion does not leave the index inconsistent.
        if (!aiClientService.deleteDocumentChunks(id, userId)) {
            throw new IllegalStateException(
                "Document index could not be deleted. Please retry when the AI service is available."
            );
        }
        documentRepository.delete(doc);
    }

    /**
     * Avoid leaving a document in the UI/database as searchable when indexing failed.
     * Chunk deletion is attempted before the document row is removed; if the RAG service
     * is unreachable, orphaned chunks are logged for subsequent maintenance and are not
     * retrievable because their owning document row is gone.
     */
    private void rollbackFailedUpload(Document doc, Path filePath, Long userId) {
        if (doc != null && doc.getId() != null) {
            boolean indexPurged = aiClientService.deleteDocumentChunks(doc.getId(), userId);
            if (!indexPurged) {
                log.error(
                    "RAG cleanup was not confirmed for failed upload doc id={}; remove any orphaned chunks during maintenance.",
                    doc.getId()
                );
            }
            try {
                documentRepository.delete(doc);
            } catch (RuntimeException ex) {
                log.error("Could not remove failed upload database record id={}", doc.getId(), ex);
            }
        }
        try {
            Files.deleteIfExists(filePath);
        } catch (IOException ex) {
            log.warn("Could not remove failed upload file {}", filePath, ex);
        }
    }

    private ResponseStatusException indexingFailure(
            String filename, AIClientService.IngestionResult ingestion) {
        int upstreamStatus = ingestion.httpStatus();
        HttpStatus responseStatus;
        if (upstreamStatus == HttpStatus.UNPROCESSABLE_ENTITY.value()) {
            responseStatus = HttpStatus.UNPROCESSABLE_ENTITY;
        } else if (upstreamStatus == HttpStatus.PAYLOAD_TOO_LARGE.value()) {
            responseStatus = HttpStatus.PAYLOAD_TOO_LARGE;
        } else if (upstreamStatus == HttpStatus.UNSUPPORTED_MEDIA_TYPE.value()) {
            responseStatus = HttpStatus.UNSUPPORTED_MEDIA_TYPE;
        } else if (upstreamStatus == HttpStatus.TOO_MANY_REQUESTS.value()) {
            responseStatus = HttpStatus.TOO_MANY_REQUESTS;
        } else {
            // 401/403 are service-to-service auth failures, not end-user auth failures.
            responseStatus = HttpStatus.SERVICE_UNAVAILABLE;
        }

        String details = ingestion.message();
        if (details == null || details.isBlank()) {
            details = responseStatus == HttpStatus.UNPROCESSABLE_ENTITY
                ? "No searchable text chunks were produced. Scanned PDFs may require Tesseract OCR."
                : "RAG did not confirm indexing. Check RAG health and ensure RAG_API_KEY matches in both services.";
        } else if (upstreamStatus == HttpStatus.UNAUTHORIZED.value()
                || upstreamStatus == HttpStatus.FORBIDDEN.value()) {
            details += " This is a backend-to-RAG authentication failure; check that RAG_API_KEY matches in both services.";
        }
        return new ResponseStatusException(
            responseStatus,
            "Document '" + filename + "' was not indexed: " + details
        );
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
