package com.librarymanagement.library_management.security;

public record JwtClaims(String role, Long studentId, String subject) {
}
