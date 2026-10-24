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
        AIClientService.IngestionResult ingestion =
            aiClientService.ingestDocumentResult(file, owner.getId(), doc.getId());

        if (ingestion.indexed()) {
            log.info("RAG indexed {} chunks for document id={}", ingestion.chunksCreated(), doc.getId());
            return toResponse(doc);
        }

        // The RAG delete endpoint verifies ownership against the document row, so purge first.
        cleanupFailedUpload(doc, filePath, owner.getId());

        int upstreamStatus = ingestion.httpStatus();
        HttpStatus publicStatus = mapIngestionFailureStatus(upstreamStatus);
        String detail = ingestion.message();
        if (detail == null || detail.isBlank()) {
            detail = upstreamStatus == HttpStatus.UNPROCESSABLE_ENTITY.value()
                ? "No searchable text chunks were produced. Scanned PDFs may require Tesseract OCR."
                : "The RAG service did not confirm indexing. Check RAG health and retry.";
        }
        if (upstreamStatus == HttpStatus.UNAUTHORIZED.value()
                || upstreamStatus == HttpStatus.FORBIDDEN.value()) {
            detail += " This is a backend-to-RAG authentication failure; ensure RAG_API_KEY matches in the root .env for both services.";
        }

        throw new ResponseStatusException(
            publicStatus,
            "Document '" + file.getOriginalFilename() + "' was not indexed: " + detail
        );
    }

    private HttpStatus mapIngestionFailureStatus(int upstreamStatus) {
        if (upstreamStatus == HttpStatus.UNPROCESSABLE_ENTITY.value()) {
            return HttpStatus.UNPROCESSABLE_ENTITY;
        }
        if (upstreamStatus == HttpStatus.PAYLOAD_TOO_LARGE.value()) {
            return HttpStatus.PAYLOAD_TOO_LARGE;
        }
        if (upstreamStatus == HttpStatus.UNSUPPORTED_MEDIA_TYPE.value()) {
            return HttpStatus.UNSUPPORTED_MEDIA_TYPE;
        }
        if (upstreamStatus == HttpStatus.TOO_MANY_REQUESTS.value()) {
            return HttpStatus.TOO_MANY_REQUESTS;
        }
        // Internal service-to-service 401/403 should not be mistaken for user auth failure.
        return HttpStatus.SERVICE_UNAVAILABLE;
    }

    private void cleanupFailedUpload(Document doc, Path filePath, Long userId) {
        if (doc != null && doc.getId() != null) {
            if (!aiClientService.deleteDocumentChunks(doc.getId(), userId)) {
                log.error(
                    "Could not confirm RAG chunk cleanup for failed upload document id={}; maintenance may need to remove orphaned chunks.",
                    doc.getId()
                );
            }
            try {
                documentRepository.deleteById(doc.getId());
            } catch (RuntimeException e) {
                log.error("Could not remove unindexed document record id={}", doc.getId(), e);
            }
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
