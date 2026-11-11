package com.theghost.api;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/v1")
public class DemoController {
    private final HttpClient client = HttpClient.newBuilder()
            .connectTimeout(java.time.Duration.ofSeconds(3)).build();
    private final String engineUrl;

    public DemoController(@Value("${ghost.engine-url:http://localhost:8001}") String engineUrl) {
        this.engineUrl = engineUrl;
    }

    @GetMapping("/health")
    public java.util.Map<String, String> health() {
        return java.util.Map.of("status", "ok", "service", "theghost-api");
    }

    // theghost-phase3-v2: fixed-route JSON gateway to the internal synthetic engine.
    // This API is a LOCAL DEMO, not a public authenticated security boundary.
    @PostMapping(value = "/engine/{operation}", consumes = "application/json", produces = "application/json")
    public ResponseEntity<String> engineOperation(@PathVariable String operation,
                                                   @RequestBody String payload) {
        if (!operation.equals("analyze") && !operation.equals("compare")
                && !operation.equals("optimize")) {
            return ResponseEntity.notFound().build();
        }
        if (payload.getBytes(java.nio.charset.StandardCharsets.UTF_8).length > 262144) {
            return ResponseEntity.status(HttpStatus.PAYLOAD_TOO_LARGE)
                    .body("{\"error\":\"Request too large\"}");
        }
        try {
            var request = HttpRequest.newBuilder(URI.create(engineUrl + "/" + operation))
                    .timeout(java.time.Duration.ofSeconds(12))
                    .header("Content-Type", "application/json")
                    .POST(HttpRequest.BodyPublishers.ofString(payload))
                    .build();
            var response = client.send(request, HttpResponse.BodyHandlers.ofString());
            // Preserve engine validation errors without disclosing internal transport errors.
            return ResponseEntity.status(response.statusCode()).body(response.body());
        } catch (Exception ex) {
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                    .body("{\"error\":\"Security engine unavailable\"}");
        }
    }

    @GetMapping(value = "/demo/{resource}", produces = "application/json")
    public ResponseEntity<String> demo(@PathVariable String resource) {
        // Strict allowlist prevents turning the demo gateway into an SSRF proxy.
        if (!resource.equals("scenario") && !resource.equals("analysis")) {
            return ResponseEntity.notFound().build();
        }
        try {
            var request = HttpRequest.newBuilder(URI.create(engineUrl + "/demo/" + resource))
                    .timeout(java.time.Duration.ofSeconds(8)).GET().build();
            var response = client.send(request, HttpResponse.BodyHandlers.ofString());
            return ResponseEntity.status(response.statusCode()).body(response.body());
        } catch (Exception ex) {
            // Do not leak internal hostnames, stack traces, or connection details.
            return ResponseEntity.status(HttpStatus.BAD_GATEWAY)
                    .body("{\"error\":\"Security engine unavailable\"}");
        }
    }
}
