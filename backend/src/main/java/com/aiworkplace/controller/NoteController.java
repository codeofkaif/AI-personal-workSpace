package com.aiworkplace.controller;

import com.aiworkplace.dto.request.NoteRequest;
import com.aiworkplace.dto.response.NoteResponse;
import com.aiworkplace.entity.User;
import com.aiworkplace.service.AuthService;
import com.aiworkplace.service.NoteService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/notes")
@RequiredArgsConstructor
public class NoteController {

    private final NoteService noteService;
    private final AuthService authService;

    @GetMapping
    public ResponseEntity<List<NoteResponse>> getNotes(@AuthenticationPrincipal UserDetails userDetails) {
        User user = authService.getCurrentUser(userDetails.getUsername());
        return ResponseEntity.ok(noteService.getNotesByUser(user.getId()));
    }

    @PostMapping
    public ResponseEntity<NoteResponse> createNote(@AuthenticationPrincipal UserDetails userDetails,
                                                    @Valid @RequestBody NoteRequest req) {
        User user = authService.getCurrentUser(userDetails.getUsername());
        return ResponseEntity.ok(noteService.createNote(user, req));
    }

    @PutMapping("/{id}")
    public ResponseEntity<NoteResponse> updateNote(@AuthenticationPrincipal UserDetails userDetails,
                                                    @PathVariable Long id,
                                                    @Valid @RequestBody NoteRequest req) {
        User user = authService.getCurrentUser(userDetails.getUsername());
        return ResponseEntity.ok(noteService.updateNote(id, user.getId(), req));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteNote(@AuthenticationPrincipal UserDetails userDetails,
                                           @PathVariable Long id) {
        User user = authService.getCurrentUser(userDetails.getUsername());
        noteService.deleteNote(id, user.getId());
        return ResponseEntity.noContent().build();
    }
}
