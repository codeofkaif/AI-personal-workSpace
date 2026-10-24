package com.aiworkplace.service;

import com.aiworkplace.dto.request.NoteRequest;
import com.aiworkplace.dto.response.NoteResponse;
import com.aiworkplace.entity.Note;
import com.aiworkplace.entity.User;
import com.aiworkplace.repository.NoteRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
@RequiredArgsConstructor
public class NoteService {

    private final NoteRepository noteRepository;

    public NoteResponse createNote(User user, NoteRequest req) {
        Note note = Note.builder()
            .title(req.getTitle()).content(req.getContent()).user(user).build();
        return toResponse(noteRepository.save(note));
    }

    public List<NoteResponse> getNotesByUser(Long userId) {
        return noteRepository.findByUserId(userId).stream().map(this::toResponse).toList();
    }

    public NoteResponse updateNote(Long id, Long userId, NoteRequest req) {
        Note note = noteRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Note not found"));
        if (!note.getUser().getId().equals(userId)) throw new RuntimeException("Unauthorized");
        note.setTitle(req.getTitle());
        note.setContent(req.getContent());
        return toResponse(noteRepository.save(note));
    }

    public void deleteNote(Long id, Long userId) {
        Note note = noteRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Note not found"));
        if (!note.getUser().getId().equals(userId)) throw new RuntimeException("Unauthorized");
        noteRepository.delete(note);
    }

    private NoteResponse toResponse(Note n) {
        return NoteResponse.builder()
            .id(n.getId()).title(n.getTitle()).content(n.getContent()).createdAt(n.getCreatedAt()).build();
    }
}
