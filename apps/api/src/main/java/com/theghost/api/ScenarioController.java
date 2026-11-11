package com.theghost.api;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import java.util.*;
import org.springframework.security.core.Authentication;

@RestController
@RequestMapping("/api/v1/scenarios")
// theghost-phase7a: all scenario operations require authenticated ownership.
public class ScenarioController {
    private final JdbcTemplate db;
    private final ObjectMapper mapper;
    private final SecurityAudit audit;
    public ScenarioController(JdbcTemplate db, ObjectMapper mapper, SecurityAudit audit) {
        this.audit = audit;
        this.db = db;
        this.mapper = mapper;
    }
    private ResponseStatusException invalid(String reason) {
        return new ResponseStatusException(HttpStatus.BAD_REQUEST, reason);
    }
    private String validate(JsonNode node) {
        if (node == null || !node.isObject()) throw invalid("Expected a scenario object");
        if (!node.path("name").isTextual() || node.path("name").asText().isBlank()
                || node.path("name").asText().length() > 160) throw invalid("Invalid scenario name");
        if (!node.path("assets").isArray() || !node.path("relationships").isArray()
                || !node.path("initial_access").isArray() || !node.path("target").isTextual())
            throw invalid("Missing scenario fields");
        if (node.path("assets").size() > 200 || node.path("relationships").size() > 1000)
            throw invalid("Scenario too large");
        Set<String> ids = new HashSet<>();
        for (JsonNode asset : node.path("assets")) {
            String id = asset.path("id").asText("");
            if (!id.matches("[A-Za-z0-9_-]{1,80}") || !ids.add(id)
                    || !asset.path("name").isTextual() || !asset.path("kind").isTextual()
                    || !asset.path("criticality").isNumber()) throw invalid("Invalid or duplicate asset");
        }
        if (!ids.contains(node.path("target").asText())) throw invalid("Unknown target");
        for (JsonNode access : node.path("initial_access"))
            if (!access.isTextual() || !ids.contains(access.asText())) throw invalid("Unknown initial access");
        Set<String> edges = new HashSet<>();
        Set<String> kinds = Set.of("connects", "trusts", "administers", "authenticates", "contains");
        for (JsonNode edge : node.path("relationships")) {
            String from = edge.path("source").asText("");
            String to = edge.path("target").asText("");
            if (!ids.contains(from) || !ids.contains(to) || !kinds.contains(edge.path("kind").asText())
                    || !edges.add(from + "->" + to)) throw invalid("Invalid or duplicate relationship");
            if (edge.has("requires")) {
                if (!edge.path("requires").isArray()) throw invalid("Invalid prerequisites");
                for (JsonNode req : edge.path("requires"))
                    if (!req.isTextual() || !ids.contains(req.asText())) throw invalid("Unknown prerequisite");
            }
        }
        if (node.has("blocked_relationships")) {
            if (!node.path("blocked_relationships").isArray()) throw invalid("Invalid blocked relationships");
            for (JsonNode edge : node.path("blocked_relationships"))
                if (!edge.isTextual() || !edges.contains(edge.asText())) throw invalid("Unknown blocked relationship");
        }
        try {
            String json = mapper.writeValueAsString(node);
            if (json.length() > 262144) throw invalid("Scenario exceeds size limit");
            return json;
        } catch (com.fasterxml.jackson.core.JsonProcessingException ex) {
            throw invalid("Invalid JSON");
        }
    }
    @GetMapping
    public List<Map<String,Object>> list(Authentication auth) {
        return db.query("SELECT id,name,revision,updated_at FROM ghost_scenarios WHERE owner_username=? ORDER BY updated_at DESC LIMIT 100",
            (rs,n) -> Map.of("id",rs.getString("id"),"name",rs.getString("name"),
                "revision",rs.getInt("revision"),"updated_at",rs.getTimestamp("updated_at").toInstant().toString()),auth.getName());
    }
    @PostMapping
    @Transactional
    public ResponseEntity<Map<String,Object>> create(@RequestBody JsonNode node, Authentication auth) {
        String json = validate(node);
        UUID id = UUID.randomUUID();
        db.update("INSERT INTO ghost_scenarios(id,name,document,owner_username) VALUES (?,?,CAST(? AS jsonb),?)",id,node.path("name").asText(),json,auth.getName());
        db.update("INSERT INTO ghost_scenario_history(scenario_id,revision,document,action) VALUES (?,1,CAST(? AS jsonb),'created')",id,json);
        audit.record(auth.getName(), "SCENARIO_CREATED", id.toString());
        return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("id",id.toString(),"revision",1));
    }
    private JsonNode decode(String json) {
        try { return mapper.readTree(json); }
        catch (Exception ex) { throw new IllegalStateException("Invalid stored document",ex); }
    }
    @GetMapping("/{id}")
    public Map<String,Object> get(@PathVariable UUID id, Authentication auth) {
        List<Map<String,Object>> rows = db.query("SELECT document::text AS document,revision FROM ghost_scenarios WHERE id=? AND owner_username=?",
            (rs,n)->Map.of("id",id.toString(),"revision",rs.getInt("revision"),"scenario",decode(rs.getString("document"))),id,auth.getName());
        if (rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Scenario not found");
        return rows.get(0);
    }
    @PutMapping("/{id}")
    @Transactional
    public Map<String,Object> update(@PathVariable UUID id,@RequestParam int expectedRevision,@RequestBody JsonNode node, Authentication auth) {
        if(expectedRevision < 1) throw invalid("Invalid revision");
        String json = validate(node);
        int changed = db.update("UPDATE ghost_scenarios SET name=?,document=CAST(? AS jsonb),revision=revision+1,updated_at=NOW() WHERE id=? AND revision=? AND owner_username=?",
            node.path("name").asText(),json,id,expectedRevision,auth.getName());
        if(changed == 0) throw new ResponseStatusException(HttpStatus.CONFLICT,"Missing scenario or stale revision");
        int revision = expectedRevision+1;
        db.update("INSERT INTO ghost_scenario_history(scenario_id,revision,document,action) VALUES (?,?,CAST(? AS jsonb),'updated')",id,revision,json);
        audit.record(auth.getName(), "SCENARIO_UPDATED", id.toString());
        return Map.of("id",id.toString(),"revision",revision);
    }
    private void requireOwner(UUID id, Authentication auth) {
        Integer count = db.queryForObject(
            "SELECT COUNT(*) FROM ghost_scenarios WHERE id=? AND owner_username=?",
            Integer.class, id, auth.getName());
        if (count == null || count == 0)
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Scenario not found");
    }
    @GetMapping("/{id}/history")
    public List<Map<String,Object>> history(@PathVariable UUID id, Authentication auth) {
        requireOwner(id, auth);
        return db.query("SELECT revision,action,recorded_at FROM ghost_scenario_history WHERE scenario_id=? AND EXISTS (SELECT 1 FROM ghost_scenarios s WHERE s.id=scenario_id AND s.owner_username=?) ORDER BY revision DESC LIMIT 100",
            (rs,n)->Map.of("revision",rs.getInt("revision"),"action",rs.getString("action"),
                "recorded_at",rs.getTimestamp("recorded_at").toInstant().toString()),id,auth.getName());
    }
    @GetMapping("/{id}/history/{revision}")
    public Map<String,Object> historyItem(@PathVariable UUID id,@PathVariable int revision, Authentication auth) {
        List<Map<String,Object>> rows = db.query("SELECT document::text AS document FROM ghost_scenario_history WHERE scenario_id=? AND revision=? AND EXISTS (SELECT 1 FROM ghost_scenarios s WHERE s.id=scenario_id AND s.owner_username=?)",
            (rs,n)->Map.of("id",id.toString(),"revision",revision,"scenario",decode(rs.getString("document"))),id,revision,auth.getName());
        if(rows.isEmpty()) throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Revision not found");
        return rows.get(0);
    }
    @DeleteMapping("/{id}")
    @Transactional
    public ResponseEntity<Void> delete(@PathVariable UUID id, Authentication auth) {
        // The historical records remain available for local audit after deletion.
        if(db.update("DELETE FROM ghost_scenarios WHERE id=? AND owner_username=?",id,auth.getName())==0)
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,"Scenario not found");
        audit.record(auth.getName(), "SCENARIO_DELETED", id.toString());
        return ResponseEntity.noContent().build();
    }
}
