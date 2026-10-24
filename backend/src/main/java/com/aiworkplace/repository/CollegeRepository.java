package com.aiworkplace.repository;
import com.aiworkplace.entity.College;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
public interface CollegeRepository extends JpaRepository<College, Long> {
    Optional<College> findByCode(String code);
    boolean existsByCode(String code);
}
