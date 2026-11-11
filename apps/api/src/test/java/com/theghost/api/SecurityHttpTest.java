package com.theghost.api;

import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.csrf;
import static org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.user;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import org.junit.jupiter.api.Test;
import jakarta.servlet.http.HttpSession;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MvcResult;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.provisioning.InMemoryUserDetailsManager;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.context.bean.override.mockito.MockitoBean;

@WebMvcTest(AuthController.class)
@AutoConfigureMockMvc
@Import({
    SecurityConfiguration.class,
    LoginAttemptGuard.class,
    SecurityHttpTest.TestUsers.class
})
class SecurityHttpTest {

    @Autowired
    private MockMvc mvc;

    @MockitoBean
    private SecurityAudit audit;

    @TestConfiguration
    static class TestUsers {

        @Bean
        UserDetailsService testUserDetailsService() {
            return new InMemoryUserDetailsManager(
                User.withUsername("test_admin")
                    .password(new org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder().encode("test-password"))
                    .roles("ADMIN")
                    .build(),
                User.withUsername("test_analyst")
                    .password(new org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder().encode("test-password"))
                    .roles("ANALYST")
                    .build()
            );
        }
    }

    @Test
    void anonymousCannotAccessScenarios() throws Exception {
        mvc.perform(get("/api/v1/scenarios"))
            .andExpect(status().isUnauthorized());
    }

    @Test
    void analystCannotAccessAdministration() throws Exception {
        mvc.perform(get("/api/v1/admin/users")
                .with(user("test_analyst").roles("ANALYST")))
            .andExpect(status().isForbidden());
    }

    @Test
    void loginWithoutCsrfIsRejected() throws Exception {
        mvc.perform(post("/api/v1/auth/login")
                .param("username", "test_admin")
                .param("password", "test-password"))
            .andExpect(status().isForbidden());
    }

    @Test
    void loginWithValidCsrfSucceeds() throws Exception {
        mvc.perform(post("/api/v1/auth/login")
                .with(csrf())
                .param("username", "test_admin")
                .param("password", "test-password"))
            .andExpect(status().isOk());
    }

    @Test
    void sixthFailedLoginReturns429() throws Exception {
        String username = "rate_limit_test_user";

        for (int attempt = 0; attempt < 5; attempt++) {
            mvc.perform(post("/api/v1/auth/login")
                    .servletPath("/api/v1/auth/login")
                    .with(csrf())
                    .param("username", username)
                    .param("password", "incorrect-password"))
                .andExpect(status().isUnauthorized());
        }

        mvc.perform(post("/api/v1/auth/login")
                .servletPath("/api/v1/auth/login")
                .with(csrf())
                .param("username", username)
                .param("password", "incorrect-password"))
            .andExpect(status().isTooManyRequests())
            .andExpect(
                org.springframework.test.web.servlet.result.MockMvcResultMatchers
                    .header().string("Retry-After", "900")
            )
            .andExpect(
                org.springframework.test.web.servlet.result.MockMvcResultMatchers
                    .jsonPath("$.error")
                    .value("TOO_MANY_LOGIN_ATTEMPTS")
            );
    }

    @Test
    void authenticatedSessionCanAccessProtectedEndpoint() throws Exception {
        MvcResult login = mvc.perform(post("/api/v1/auth/login")
                .with(csrf())
                .param("username", "test_admin")
                .param("password", "test-password"))
            .andExpect(status().isOk())
            .andReturn();

        HttpSession session = login.getRequest().getSession(false);

        org.junit.jupiter.api.Assertions.assertNotNull(
            session,
            "Successful login must create an authenticated session."
        );

        mvc.perform(get("/api/v1/admin/users")
                .session((MockHttpSession) session))
            .andExpect(status().isNotFound());
    }

    @Test
    void logoutInvalidatesAuthenticatedSession() throws Exception {
        MvcResult login = mvc.perform(post("/api/v1/auth/login")
                .with(csrf())
                .param("username", "test_admin")
                .param("password", "test-password"))
            .andExpect(status().isOk())
            .andReturn();

        MockHttpSession session = (MockHttpSession)
            login.getRequest().getSession(false);

        org.junit.jupiter.api.Assertions.assertNotNull(session);

        mvc.perform(post("/api/v1/auth/logout")
                .session(session)
                .with(csrf()))
            .andExpect(status().isNoContent());

        org.junit.jupiter.api.Assertions.assertTrue(
            session.isInvalid(),
            "Logout must invalidate the HTTP session."
        );

        mvc.perform(get("/api/v1/admin/users"))
            .andExpect(status().isUnauthorized());
    }
}
