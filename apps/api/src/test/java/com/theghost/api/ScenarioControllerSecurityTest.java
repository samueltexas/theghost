package com.theghost.api;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

import java.util.UUID;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.web.server.ResponseStatusException;

class ScenarioControllerSecurityTest {

    private JdbcTemplate db;
    private SecurityAudit audit;
    private ScenarioController controller;
    private Authentication analyst;

    @BeforeEach
    void setUp() {
        db = mock(JdbcTemplate.class);
        audit = mock(SecurityAudit.class);

        controller = new ScenarioController(
            db,
            new ObjectMapper(),
            audit
        );

        analyst = new UsernamePasswordAuthenticationToken(
            "analyst_test",
            null,
            java.util.List.of()
        );
    }

    @Test
    void historyRejectsScenarioNotOwnedByUser() {
        UUID scenarioId = UUID.randomUUID();

        when(db.queryForObject(
            anyString(),
            eq(Integer.class),
            eq(scenarioId),
            eq("analyst_test")
        )).thenReturn(0);

        ResponseStatusException exception = assertThrows(
            ResponseStatusException.class,
            () -> controller.history(scenarioId, analyst)
        );

        assertEquals(HttpStatus.NOT_FOUND, exception.getStatusCode());
        verify(db, never()).query(anyString(), any(org.springframework.jdbc.core.RowMapper.class), any(Object[].class));
    }

    @Test
    void deletionMustIncludeAuthenticatedOwner() {
        UUID scenarioId = UUID.randomUUID();

        when(db.update(
            anyString(),
            eq(scenarioId),
            eq("analyst_test")
        )).thenReturn(1);

        var response = controller.delete(scenarioId, analyst);

        assertEquals(HttpStatus.NO_CONTENT, response.getStatusCode());

        verify(db).update(
            contains("owner_username=?"),
            eq(scenarioId),
            eq("analyst_test")
        );

        verify(audit).record(
            "analyst_test",
            "SCENARIO_DELETED",
            scenarioId.toString()
        );
    }

    @Test
    void deletionRejectsScenarioNotOwnedByUser() {
        UUID scenarioId = UUID.randomUUID();

        when(db.update(
            anyString(),
            eq(scenarioId),
            eq("analyst_test")
        )).thenReturn(0);

        ResponseStatusException exception = assertThrows(
            ResponseStatusException.class,
            () -> controller.delete(scenarioId, analyst)
        );

        assertEquals(HttpStatus.NOT_FOUND, exception.getStatusCode());
        verifyNoInteractions(audit);
    }
}
