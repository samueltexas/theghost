package com.theghost.api;

import static org.junit.jupiter.api.Assertions.*;

import org.junit.jupiter.api.Test;

class LoginAttemptGuardTest {

    @Test
    void blocksAfterFiveFailures() {
        LoginAttemptGuard guard = new LoginAttemptGuard();
        String key = "127.0.0.1:test-user";

        for (int attempt = 0; attempt < 5; attempt++) {
            assertFalse(guard.blocked(key));
            guard.failed(key);
        }

        assertTrue(guard.blocked(key));
    }

    @Test
    void successfulLoginClearsFailures() {
        LoginAttemptGuard guard = new LoginAttemptGuard();
        String key = "127.0.0.1:test-user";

        for (int attempt = 0; attempt < 5; attempt++) {
            guard.failed(key);
        }

        assertTrue(guard.blocked(key));

        guard.succeeded(key);

        assertFalse(guard.blocked(key));
    }

    @Test
    void failuresAreIsolatedByKey() {
        LoginAttemptGuard guard = new LoginAttemptGuard();

        for (int attempt = 0; attempt < 5; attempt++) {
            guard.failed("127.0.0.1:user-a");
        }

        assertTrue(guard.blocked("127.0.0.1:user-a"));
        assertFalse(guard.blocked("127.0.0.1:user-b"));
    }
}
