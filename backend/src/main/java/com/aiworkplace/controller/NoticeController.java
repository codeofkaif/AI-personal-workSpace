package com.aiworkplace.controller;

import com.aiworkplace.dto.request.NoticeRequest;
import com.aiworkplace.dto.response.NoticeResponse;
import com.aiworkplace.entity.User;
import com.aiworkplace.service.AuthService;
import com.aiworkplace.service.NoticeService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/notices")
@RequiredArgsConstructor
public class NoticeController {

    private final NoticeService noticeService;
    private final AuthService authService;

    @GetMapping
    public ResponseEntity<List<NoticeResponse>> getNotices(@AuthenticationPrincipal UserDetails userDetails) {
        User user = authService.getCurrentUser(userDetails.getUsername());
        return ResponseEntity.ok(noticeService.getNoticesForUser(user));
    }

    @GetMapping("/all")
    public ResponseEntity<List<NoticeResponse>> getAllNotices() {
        return ResponseEntity.ok(noticeService.getAllNotices());
    }

    @PostMapping
    @PreAuthorize("hasAnyRole('ADMIN', 'COLLEGE_ADMIN', 'DEAN', 'HOD')")
    public ResponseEntity<NoticeResponse> createNotice(
            @AuthenticationPrincipal UserDetails userDetails,
            @Valid @RequestBody NoticeRequest req) {
        User user = authService.getCurrentUser(userDetails.getUsername());
        return ResponseEntity.ok(noticeService.createNotice(user, req));
    }

    @DeleteMapping("/{id}")
    @PreAuthorize("hasAnyRole('ADMIN', 'COLLEGE_ADMIN', 'DEAN', 'HOD')")
    public ResponseEntity<Void> deleteNotice(
            @AuthenticationPrincipal UserDetails userDetails,
            @PathVariable Long id) {
        User user = authService.getCurrentUser(userDetails.getUsername());
        noticeService.deleteNotice(id, user);
        return ResponseEntity.noContent().build();
    }
}
