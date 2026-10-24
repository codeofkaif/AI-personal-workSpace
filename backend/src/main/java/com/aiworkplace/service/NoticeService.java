package com.aiworkplace.service;

import com.aiworkplace.dto.request.NoticeRequest;
import com.aiworkplace.dto.response.NoticeResponse;
import com.aiworkplace.entity.Notice;
import com.aiworkplace.entity.User;
import com.aiworkplace.repository.NoticeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.util.List;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class NoticeService {

    private final NoticeRepository noticeRepository;
    private final UserActivityService activityService;

    public List<NoticeResponse> getAllNotices() {
        return noticeRepository.findAllByOrderByCreatedAtDesc()
            .stream()
            .map(this::mapToResponse)
            .collect(Collectors.toList());
    }

    public List<NoticeResponse> getNoticesForUser(User user) {
        String dept = user.getDepartment() != null ? user.getDepartment() : "CSE";
        List<String> audiences = List.of("ALL", dept, dept.toUpperCase());
        return noticeRepository.findByTargetAudienceInOrderByCreatedAtDesc(audiences)
            .stream()
            .map(this::mapToResponse)
            .collect(Collectors.toList());
    }

    public NoticeResponse createNotice(User publisher, NoticeRequest req) {
        Notice notice = Notice.builder()
            .title(req.getTitle())
            .content(req.getContent())
            .category(req.getCategory() != null ? req.getCategory() : "General")
            .targetAudience(req.getTargetAudience() != null ? req.getTargetAudience() : "ALL")
            .publishedByRole(publisher.getRole())
            .publishedByName(publisher.getName())
            .priority(req.getPriority() != null ? req.getPriority() : "MEDIUM")
            .build();

        notice = noticeRepository.save(notice);

        activityService.logActivity(publisher, "NOTICE_PUBLISH",
            "Published notice: " + notice.getTitle() + " for " + notice.getTargetAudience());

        return mapToResponse(notice);
    }

    public void deleteNotice(Long id, User user) {
        Notice notice = noticeRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Notice not found: " + id));

        // Security check: Only Admin, Dean, or the original publisher can delete
        boolean canDelete = user.getRole() == User.Role.ADMIN ||
                            user.getRole() == User.Role.COLLEGE_ADMIN ||
                            user.getRole() == User.Role.DEAN ||
                            (user.getRole() == User.Role.HOD && notice.getPublishedByName().equals(user.getName()));

        if (!canDelete) {
            throw new RuntimeException("Unauthorized: You do not have permission to delete this notice");
        }

        noticeRepository.delete(notice);
        activityService.logActivity(user, "NOTICE_DELETE", "Deleted notice id: " + id);
    }

    private NoticeResponse mapToResponse(Notice n) {
        return NoticeResponse.builder()
            .id(n.getId())
            .title(n.getTitle())
            .content(n.getContent())
            .category(n.getCategory())
            .targetAudience(n.getTargetAudience())
            .publishedByRole(n.getPublishedByRole().name())
            .publishedByName(n.getPublishedByName())
            .priority(n.getPriority())
            .createdAt(n.getCreatedAt())
            .build();
    }
}
