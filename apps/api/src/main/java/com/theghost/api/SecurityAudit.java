package com.theghost.api;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

/** Persists security events without passwords, session IDs, or CSRF tokens. */
@Service
public class SecurityAudit {
    private final JdbcTemplate db;

    public SecurityAudit(JdbcTemplate db) {
        this.db = db;
    }

    public void record(String actor, String action, String subject) {
        db.update("INSERT INTO ghost_security_audit(actor,action,subject) VALUES (?,?,?)",
            truncate(actor, 80), truncate(action, 64), truncate(subject, 160));
    }

    private String truncate(String value, int max) {
        String safe = value == null ? "unknown" : value;
        return safe.length() <= max ? safe : safe.substring(0, max);
    }
}
