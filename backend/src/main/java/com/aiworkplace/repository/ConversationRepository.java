package com.aiworkplace.repository;
import com.aiworkplace.entity.Conversation;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
public interface ConversationRepository extends JpaRepository<Conversation, Long> {
    List<Conversation> findByUserIdOrderByCreatedAtDesc(Long userId);
}
