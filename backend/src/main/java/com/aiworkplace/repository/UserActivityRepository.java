package com.aiworkplace.repository;

import com.aiworkplace.entity.UserActivity;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface UserActivityRepository extends JpaRepository<UserActivity, Long> {
    List<UserActivity> findAllByOrderByTimestampDesc(Pageable pageable);
    List<UserActivity> findByUserIdOrderByTimestampDesc(Long userId, Pageable pageable);
}
