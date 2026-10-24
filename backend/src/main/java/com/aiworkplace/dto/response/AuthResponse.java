package com.aiworkplace.dto.response;
import lombok.*;
@Data @Builder @AllArgsConstructor @NoArgsConstructor
public class AuthResponse {
    private String token;
    private Long userId;
    private String name;
    private String email;
    private String role;
    private String collegeName;
}
