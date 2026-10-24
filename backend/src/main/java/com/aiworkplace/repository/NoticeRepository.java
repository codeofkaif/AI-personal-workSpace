package com.aiworkplace.repository;

import com.aiworkplace.entity.Notice;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface NoticeRepository extends JpaRepository<Notice, Long> {
    List<Notice> findAllByOrderByCreatedAtDesc();
    List<Notice> findByTargetAudienceInOrderByCreatedAtDesc(List<String> audiences);
}
