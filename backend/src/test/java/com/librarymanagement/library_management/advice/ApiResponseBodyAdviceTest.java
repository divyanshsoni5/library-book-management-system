package com.librarymanagement.library_management.advice;

import com.librarymanagement.library_management.dto.ApiResponse;
import org.junit.jupiter.api.Test;
import org.springframework.core.MethodParameter;
import org.springframework.http.MediaType;
import org.springframework.http.converter.HttpMessageConverter;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;
import org.springframework.http.server.ServletServerHttpRequest;
import org.springframework.http.server.ServletServerHttpResponse;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

public class ApiResponseBodyAdviceTest {

    private final ApiResponseBodyAdvice advice = new ApiResponseBodyAdvice();

    @Test
    public void keepsFineStatusUnwrapped() {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/library/students/42/fine-status");
        Object body = new Object();

        Object result = advice.beforeBodyWrite(
                body,
                (MethodParameter) null,
                MediaType.APPLICATION_JSON,
                (Class<? extends HttpMessageConverter<?>>) null,
                new ServletServerHttpRequest(request),
                new ServletServerHttpResponse(new MockHttpServletResponse()));

        assertSame(body, result);
    }

    @Test
    public void keepsActiveIssueUnwrapped() {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/library/students/42/has-active-issue");
        Object body = new Object();

        Object result = advice.beforeBodyWrite(
                body,
                (MethodParameter) null,
                MediaType.APPLICATION_JSON,
                (Class<? extends HttpMessageConverter<?>>) null,
                new ServletServerHttpRequest(request),
                new ServletServerHttpResponse(new MockHttpServletResponse()));

        assertSame(body, result);
    }

    @Test
    public void wrapsRegularResponses() {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", "/api/v1/library/student/books");
        Object body = "payload";

        Object result = advice.beforeBodyWrite(
                body,
                (MethodParameter) null,
                MediaType.APPLICATION_JSON,
                (Class<? extends HttpMessageConverter<?>>) null,
                new ServletServerHttpRequest(request),
                new ServletServerHttpResponse(new MockHttpServletResponse()));

        assertTrue(result instanceof ApiResponse);
        ApiResponse<?> apiResponse = (ApiResponse<?>) result;
        assertEquals(true, apiResponse.isSuccess());
        assertEquals(body, apiResponse.getData());
        assertEquals("Success", apiResponse.getMessage());
    }
}
