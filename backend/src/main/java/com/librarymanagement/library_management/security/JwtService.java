package com.librarymanagement.library_management.security;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.Base64;

@Service
public class JwtService {
    private static final String HMAC_ALGORITHM = "HmacSHA256";
    private final ObjectMapper objectMapper;
    private final String secret;

    public JwtService(ObjectMapper objectMapper, @Value("${jwt.secret}") String secret) {
        this.objectMapper = objectMapper;
        this.secret = secret;
    }

    public JwtClaims parseAndValidate(String token) {
        String[] parts = token.split("\\.");
        if (parts.length != 3) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid JWT token.");
        }

        byte[] headerBytes = decodeBase64Url(parts[0]);
        byte[] payloadBytes = decodeBase64Url(parts[1]);
        byte[] signatureBytes = decodeBase64Url(parts[2]);

        validateSignature(parts[0] + "." + parts[1], signatureBytes);

        try {
            JsonNode payload = objectMapper.readTree(payloadBytes);
            String role = readText(payload, "role");
            if (role == null) {
                role = readText(payload, "roles");
            }
            if (role != null) {
                role = role.trim().toUpperCase();
            }

            Long studentId = readLong(payload, "studentId");
            if (studentId == null) {
                studentId = readLong(payload, "userId");
            }

            String subject = readText(payload, "sub");
            return new JwtClaims(role, studentId, subject);
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unable to decode JWT payload.");
        }
    }

    private void validateSignature(String signingInput, byte[] providedSignature) {
        try {
            Mac mac = Mac.getInstance(HMAC_ALGORITHM);
            mac.init(new SecretKeySpec(secret.getBytes(StandardCharsets.UTF_8), HMAC_ALGORITHM));
            byte[] expectedSignature = mac.doFinal(signingInput.getBytes(StandardCharsets.UTF_8));
            if (!MessageDigest.isEqual(expectedSignature, providedSignature)) {
                throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid JWT signature.");
            }
        } catch (ResponseStatusException ex) {
            throw ex;
        } catch (Exception ex) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Unable to validate JWT signature.");
        }
    }

    private byte[] decodeBase64Url(String value) {
        try {
            return Base64.getUrlDecoder().decode(value);
        } catch (IllegalArgumentException ex) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Invalid JWT token encoding.");
        }
    }

    private String readText(JsonNode node, String fieldName) {
        JsonNode value = node.get(fieldName);
        if (value == null || value.isNull()) {
            return null;
        }
        return value.asText(null);
    }

    private Long readLong(JsonNode node, String fieldName) {
        JsonNode value = node.get(fieldName);
        if (value == null || value.isNull()) {
            return null;
        }
        if (value.isNumber()) {
            return value.longValue();
        }
        try {
            return Long.parseLong(value.asText());
        } catch (NumberFormatException ex) {
            return null;
        }
    }
}
