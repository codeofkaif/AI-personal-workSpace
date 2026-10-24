package com.aiworkplace.service;

import com.aiworkplace.dto.response.DocumentResponse;
import com.aiworkplace.entity.Document;
import com.aiworkplace.entity.User;
import com.aiworkplace.repository.DocumentRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.multipart.MultipartFile;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class DocumentServiceTest {

    @Mock
    private DocumentRepository documentRepository;

    @Mock
    private AIClientService aiClientService;

    @InjectMocks
    private DocumentService documentService;

    @TempDir
    Path tempDir;

    private User user;

    @BeforeEach
    void setUp() {
        user = mock(User.class);
        when(user.getId()).thenReturn(7L);
        ReflectionTestUtils.setField(documentService, "uploadDir", tempDir.toString());
    }

    private MockMultipartFile textFile() {
        return new MockMultipartFile(
            "file", "fresh-notes.txt", "text/plain",
            "Exact marker: ORBITAL-ATLAS-7391".getBytes()
        );
    }

    private void assignSavedDocumentId() {
        when(documentRepository.save(any(Document.class))).thenAnswer(invocation -> {
            Document saved = invocation.getArgument(0);
            saved.setId(99L);
            return saved;
        });
    }

    private long filesInUploadDirectory() throws Exception {
        try (var files = Files.list(tempDir)) {
            return files.count();
        }
    }

    @Test
    void uploadReturnsOnlyAfterRagConfirmsPositiveChunkCount() throws Exception {
        assignSavedDocumentId();
        when(aiClientService.ingestDocumentResult(any(MultipartFile.class), eq(7L), eq(99L)))
            .thenReturn(new AIClientService.IngestionResult(1, 200, "indexed"));

        DocumentResponse response = documentService.uploadDocument(user, textFile());

        assertEquals("fresh-notes.txt", response.getTitle());
        verify(documentRepository, never()).deleteById(anyLong());
        verify(aiClientService).ingestDocumentResult(any(MultipartFile.class), eq(7L), eq(99L));
        assertEquals(1L, filesInUploadDirectory());
    }

    @Test
    void zeroChunkScannedUploadIsRejectedAndCleanedUp() throws Exception {
        assignSavedDocumentId();
        when(aiClientService.ingestDocumentResult(any(MultipartFile.class), eq(7L), eq(99L)))
            .thenReturn(new AIClientService.IngestionResult(
                0, 422, "OCR is enabled, but the Tesseract executable is missing."
            ));
        when(aiClientService.deleteDocumentChunks(99L, 7L)).thenReturn(true);

        ResponseStatusException error = assertThrows(
            ResponseStatusException.class,
            () -> documentService.uploadDocument(user, textFile())
        );

        assertEquals(HttpStatus.UNPROCESSABLE_ENTITY, error.getStatusCode());
        assertTrue(error.getReason().contains("Tesseract"));
        verify(documentRepository).deleteById(99L);
        verify(aiClientService).deleteDocumentChunks(99L, 7L);
        assertEquals(0L, filesInUploadDirectory());
    }

    @Test
    void ragAuthenticationMismatchDoesNotLeaveAnUnindexedDocument() throws Exception {
        assignSavedDocumentId();
        when(aiClientService.ingestDocumentResult(any(MultipartFile.class), eq(7L), eq(99L)))
            .thenReturn(new AIClientService.IngestionResult(-1, 401, "Unauthorized RAG service request."));
        when(aiClientService.deleteDocumentChunks(99L, 7L)).thenReturn(true);

        ResponseStatusException error = assertThrows(
            ResponseStatusException.class,
            () -> documentService.uploadDocument(user, textFile())
        );

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, error.getStatusCode());
        assertTrue(error.getReason().contains("RAG_API_KEY"));
        verify(documentRepository).deleteById(99L);
        assertEquals(0L, filesInUploadDirectory());
    }
}
