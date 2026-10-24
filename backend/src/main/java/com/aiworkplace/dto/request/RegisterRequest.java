package com.aiworkplace.dto.request;
import jakarta.validation.constraints.*;
import lombok.Data;
@Data
public class RegisterRequest {
    @NotBlank private String name;
    @Email @NotBlank private String email;
    @Size(min=6) @NotBlank private String password;
    private String collegeCode;
    private String role = "STUDENT";
    private String department;
}
