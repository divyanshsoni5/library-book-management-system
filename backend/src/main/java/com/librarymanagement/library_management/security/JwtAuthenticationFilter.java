package com.librarymanagement.library_management.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Qualifier;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.cors.CorsUtils;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.HandlerExceptionResolver;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;

@Component
public class JwtAuthenticationFilter extends OncePerRequestFilter {
    private static final String ROLE_ATTR = "jwtRole";
    private static final String STUDENT_ID_ATTR = "jwtStudentId";
    private final JwtService jwtService;
    private final HandlerExceptionResolver handlerExceptionResolver;

    public JwtAuthenticationFilter(JwtService jwtService,
            @Qualifier("handlerExceptionResolver") HandlerExceptionResolver handlerExceptionResolver) {
        this.jwtService = jwtService;
        this.handlerExceptionResolver = handlerExceptionResolver;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        if (CorsUtils.isPreFlightRequest(request) || HttpMethod.OPTIONS.matches(request.getMethod())) {
            return true;
        }
        return "/api/v1/library/health".equals(path) || "/api/v1/library/users/login".equals(path);
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        String authorization = request.getHeader(HttpHeaders.AUTHORIZATION);
        if (authorization == null || !authorization.startsWith("Bearer ")) {
            handleError(request, response, new ResponseStatusException(HttpStatus.UNAUTHORIZED,
                    "Missing Bearer token in Authorization header."));
            return;
        }

        try {
            JwtClaims claims = jwtService.parseAndValidate(authorization.substring(7).trim());
            if (claims.role() != null) {
                request.setAttribute(ROLE_ATTR, claims.role());
            }
            if (claims.studentId() != null) {
                request.setAttribute(STUDENT_ID_ATTR, claims.studentId());
            }
            filterChain.doFilter(request, response);
        } catch (RuntimeException ex) {
            handleError(request, response, ex);
        }
    }

    private void handleError(HttpServletRequest request, HttpServletResponse response, RuntimeException ex)
            throws IOException {
        if (handlerExceptionResolver.resolveException(request, response, null, ex) == null) {
            response.sendError(HttpStatus.UNAUTHORIZED.value(), ex.getMessage());
        }
    }
}
