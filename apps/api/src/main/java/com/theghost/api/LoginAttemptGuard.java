package com.theghost.api;

import java.time.Duration;
import java.time.Instant;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Component;

/** Local-only protection. Use a shared store when deploying multiple API replicas. */
@Component
public class LoginAttemptGuard {
    private static final int MAX_FAILURES = 5;
    private static final Duration WINDOW = Duration.ofMinutes(15);
    private final ConcurrentHashMap<String, Entry> entries = new ConcurrentHashMap<>();

    private record Entry(int failures, Instant started) {}

    public boolean blocked(String key) {
        Entry current = entries.get(key);
        if (current == null) return false;
        if (Instant.now().isAfter(current.started().plus(WINDOW))) {
            entries.remove(key, current);
            return false;
        }
        return current.failures() >= MAX_FAILURES;
    }

    public void failed(String key) {
        Instant now = Instant.now();
        entries.compute(key, (ignored, old) -> {
            if (old == null || now.isAfter(old.started().plus(WINDOW)))
                return new Entry(1, now);
            return new Entry(Math.min(MAX_FAILURES, old.failures() + 1), old.started());
        });
    }

    public void succeeded(String key) {
        entries.remove(key);
    }
}
