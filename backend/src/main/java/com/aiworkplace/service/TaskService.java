package com.aiworkplace.service;

import com.aiworkplace.dto.request.TaskRequest;
import com.aiworkplace.dto.response.TaskResponse;
import com.aiworkplace.entity.Task;
import com.aiworkplace.entity.User;
import com.aiworkplace.repository.TaskRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import java.util.List;

@Service
@RequiredArgsConstructor
public class TaskService {

    private final TaskRepository taskRepository;

    public TaskResponse createTask(User user, TaskRequest req) {
        Task task = Task.builder()
            .title(req.getTitle()).description(req.getDescription())
            .dueDate(req.getDueDate())
            .status(Task.Status.valueOf(req.getStatus().toUpperCase()))
            .user(user).build();
        return toResponse(taskRepository.save(task));
    }

    public List<TaskResponse> getTasksByUser(Long userId) {
        return taskRepository.findByUserId(userId).stream().map(this::toResponse).toList();
    }

    public TaskResponse updateTask(Long id, Long userId, TaskRequest req) {
        Task task = taskRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Task not found"));
        if (!task.getUser().getId().equals(userId)) throw new RuntimeException("Unauthorized");
        task.setTitle(req.getTitle());
        task.setDescription(req.getDescription());
        task.setDueDate(req.getDueDate());
        task.setStatus(Task.Status.valueOf(req.getStatus().toUpperCase()));
        return toResponse(taskRepository.save(task));
    }

    public TaskResponse markAsComplete(Long id, Long userId) {
        Task task = taskRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Task not found"));
        if (!task.getUser().getId().equals(userId)) throw new RuntimeException("Unauthorized");
        task.setStatus(Task.Status.COMPLETED);
        return toResponse(taskRepository.save(task));
    }

    public void deleteTask(Long id, Long userId) {
        Task task = taskRepository.findById(id)
            .orElseThrow(() -> new RuntimeException("Task not found"));
        if (!task.getUser().getId().equals(userId)) throw new RuntimeException("Unauthorized");
        taskRepository.delete(task);
    }

    private TaskResponse toResponse(Task t) {
        return TaskResponse.builder()
            .id(t.getId()).title(t.getTitle()).description(t.getDescription())
            .status(t.getStatus().name()).dueDate(t.getDueDate()).createdAt(t.getCreatedAt()).build();
    }
}
