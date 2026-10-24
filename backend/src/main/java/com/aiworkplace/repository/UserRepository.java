package com.aiworkplace.repository;
import com.aiworkplace.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;
public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByEmail(String email);
    boolean existsByEmail(String email);
    java.util.List<User> findByRole(User.Role role);
    java.util.List<User> findByDepartment(String department);
    long countByRole(User.Role role);
}
