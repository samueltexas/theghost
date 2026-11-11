package com.theghost.api;

import java.io.IOException;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.web.filter.OncePerRequestFilter;

/** Rejects repeated login attempts before authentication processing. */
public class LoginRateLimitFilter extends OncePerRequestFilter {
    private final LoginAttemptGuard guard;

    public LoginRateLimitFilter(LoginAttemptGuard guard) {
        this.guard = guard;
    }

    static String key(HttpServletRequest request) {
        String username = request.getParameter("username");
        String safeUsername = username == null ? "" : username.strip().toLowerCase(java.util.Locale.ROOT);
        if (safeUsername.length() > 80) safeUsername = safeUsername.substring(0, 80);
        return request.getRemoteAddr() + ":" + safeUsername;
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response,
            FilterChain chain) throws ServletException, IOException {
        if ("POST".equals(request.getMethod()) && "/api/v1/auth/login".equals(request.getServletPath())
                && guard.blocked(key(request))) {
            // Return 429 directly to avoid an error dispatch changing the status.
            response.setStatus(429);
            response.setHeader("Retry-After", "900");
            response.setContentType("application/json");
            response.setCharacterEncoding("UTF-8");
            response.getWriter().write(
                    "{\"error\":\"TOO_MANY_LOGIN_ATTEMPTS\",\"retryAfterSeconds\":900}"
            );
            return;
        }
        chain.doFilter(request, response);
    }
}
