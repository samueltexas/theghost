package com.theghost.api;
import java.util.Map;
import org.springframework.http.CacheControl;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.web.csrf.CsrfToken;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {
 @GetMapping("/session")
 public ResponseEntity<Map<String,Object>> session(Authentication authentication,CsrfToken csrf){
  boolean signedIn=authentication!=null&&authentication.isAuthenticated()&&!(authentication instanceof AnonymousAuthenticationToken);
  return ResponseEntity.ok().cacheControl(CacheControl.noStore()).body(Map.of(
   "authenticated",signedIn,"username",signedIn?authentication.getName():"",
   "role",signedIn?authentication.getAuthorities().stream().findFirst().map(x->x.getAuthority().replace("ROLE_","")).orElse(""):"","csrfToken",csrf.getToken(),"csrfHeader",csrf.getHeaderName()));
 }
}
