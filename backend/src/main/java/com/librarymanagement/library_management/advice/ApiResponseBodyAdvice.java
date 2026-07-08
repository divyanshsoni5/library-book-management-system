package com.librarymanagement.library_management.advice;

import com.librarymanagement.library_management.dto.ApiResponse;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.core.MethodParameter;
import org.springframework.http.MediaType;
import org.springframework.http.converter.HttpMessageConverter;
import org.springframework.http.server.ServerHttpRequest;
import org.springframework.http.server.ServerHttpResponse;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.mvc.method.annotation.ResponseBodyAdvice;

@RestControllerAdvice
public class ApiResponseBodyAdvice implements ResponseBodyAdvice<Object> {
    @Override
    public boolean supports(MethodParameter returnType, Class<? extends HttpMessageConverter<?>> converterType) {
        return true;
    }

    @Override
    public Object beforeBodyWrite(Object body, MethodParameter returnType, MediaType selectedContentType,
            Class<? extends HttpMessageConverter<?>> selectedConverterType, ServerHttpRequest request,
            ServerHttpResponse response) {
        if (body == null || body instanceof ApiResponse<?>) {
            return body;
        }

        HttpServletRequest servletRequest = (HttpServletRequest) request.getServletRequest();
        String requestUri = servletRequest.getRequestURI();
        if (requestUri.endsWith("/health")
                || requestUri.matches(".*/students/[^/]+/fine-status$")
                || requestUri.matches(".*/students/[^/]+/has-active-issue$")) {
            return body;
        }

        return new ApiResponse<>(true, body, "Success");
    }
}
