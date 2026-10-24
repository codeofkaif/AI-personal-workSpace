package com.aiworkplace.service;

import com.aiworkplace.entity.User;
import com.aiworkplace.entity.UserActivity;
import com.aiworkplace.repository.UserActivityRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
@RequiredArgsConstructor
public class UserActivityService {

    private final UserActivityRepository activityRepository;

    public void logActivity(User user, String action, String details) {
        try {
            UserActivity activity = UserActivity.builder()
                .userId(user != null ? user.getId() : null)
                .userName(user != null ? user.getName() : "Anonymous")
                .userEmail(user != null ? user.getEmail() : "anonymous")
                .userRole(user != null ? user.getRole().name() : "GUEST")
                .action(action)
                .details(details)
                .build();
            activityRepository.save(activity);
        } catch (Exception e) {
            // non-blocking
        }
    }

    public List<UserActivity> getRecentActivities(int limit) {
        return activityRepository.findAllByOrderByTimestampDesc(PageRequest.of(0, limit));
    }

    public List<UserActivity> getActivitiesByUser(Long userId, int limit) {
        return activityRepository.findByUserIdOrderByTimestampDesc(userId, PageRequest.of(0, limit));
    }
}
