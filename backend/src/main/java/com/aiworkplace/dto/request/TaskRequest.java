package com.aiworkplace.dto.request;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;
import java.time.LocalDate;
@Data
public class TaskRequest {
    @NotBlank private String title;
    private String description;
    private LocalDate dueDate;
    private String status = "PENDING";
}
