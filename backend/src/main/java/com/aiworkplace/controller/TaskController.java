package com.aiworkplace.controller;

import com.aiworkplace.dto.request.TaskRequest;
import com.aiworkplace.dto.response.TaskResponse;
import com.aiworkplace.entity.User;
import com.aiworkplace.service.AuthService;
import com.aiworkplace.service.TaskService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import java.util.List;

@RestController
@RequestMapping("/api/tasks")
@RequiredArgsConstructor
public class TaskController {

    private final TaskService taskService;
    private final AuthService authService;

    @GetMapping
    public ResponseEntity<List<TaskResponse>> getTasks(@AuthenticationPrincipal UserDetails userDetails) {
        User user = authService.getCurrentUser(userDetails.getUsername());
        return ResponseEntity.ok(taskService.getTasksByUser(user.getId()));
    }

    @PostMapping
    public ResponseEntity<TaskResponse> createTask(@AuthenticationPrincipal UserDetails userDetails,
                                                    @Valid @RequestBody TaskRequest req) {
        User user = authService.getCurrentUser(userDetails.getUsername());
        return ResponseEntity.ok(taskService.createTask(user, req));
    }

    @PutMapping("/{id}")
    public ResponseEntity<TaskResponse> updateTask(@AuthenticationPrincipal UserDetails userDetails,
                                                    @PathVariable Long id,
                                                    @Valid @RequestBody TaskRequest req) {
        User user = authService.getCurrentUser(userDetails.getUsername());
        return ResponseEntity.ok(taskService.updateTask(id, user.getId(), req));
    }

    @PatchMapping("/{id}/complete")
    public ResponseEntity<TaskResponse> markComplete(@AuthenticationPrincipal UserDetails userDetails,
                                                      @PathVariable Long id) {
        User user = authService.getCurrentUser(userDetails.getUsername());
        return ResponseEntity.ok(taskService.markAsComplete(id, user.getId()));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteTask(@AuthenticationPrincipal UserDetails userDetails,
                                            @PathVariable Long id) {
        User user = authService.getCurrentUser(userDetails.getUsername());
        taskService.deleteTask(id, user.getId());
        return ResponseEntity.noContent().build();
    }
}
