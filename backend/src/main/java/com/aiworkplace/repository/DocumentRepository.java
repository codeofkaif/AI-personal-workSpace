package com.aiworkplace.repository;
import com.aiworkplace.entity.Document;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface DocumentRepository extends JpaRepository<Document, Long> {
    List<Document> findByUserId(Long userId);
    List<Document> findByCollegeId(Long collegeId);
    List<Document> findByIsCollegeDocTrue();
    void deleteById(Long id);
}
