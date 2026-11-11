package com.theghost.api;

import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/v1/admin")
public class UserAdminController {
 private final JdbcTemplate db;
 private final PasswordEncoder encoder;
 public UserAdminController(JdbcTemplate db,PasswordEncoder encoder){this.db=db;this.encoder=encoder;}
 public record NewUser(String username,String password,String role){}
 @GetMapping("/users")
 public List<Map<String,Object>> users(){
  return db.query("SELECT username,role,enabled FROM ghost_users ORDER BY username",
   (rs,n)->Map.of("username",rs.getString("username"),"role",rs.getString("role"),"enabled",rs.getBoolean("enabled")));
 }
 @PostMapping("/users")
 public ResponseEntity<Map<String,String>> create(@RequestBody NewUser user,Authentication auth){
  if(user==null||user.username()==null||!user.username().matches("[A-Za-z][A-Za-z0-9_-]{2,39}")
      ||user.password()==null||user.password().length()<16||user.password().length()>128
      ||!("ADMIN".equals(user.role())||"ANALYST".equals(user.role())))
   throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"Invalid user data");
  try {
   db.update("INSERT INTO ghost_users(username,password_hash,role) VALUES (?,?,?)",
      user.username(),encoder.encode(user.password()),user.role());
  }catch(org.springframework.dao.DuplicateKeyException ex){
   throw new ResponseStatusException(HttpStatus.CONFLICT,"Username already exists");
  }
  db.update("INSERT INTO ghost_security_audit(actor,action,subject) VALUES (?,?,?)",
      auth.getName(),"USER_CREATED",user.username());
  return ResponseEntity.status(HttpStatus.CREATED).body(Map.of("username",user.username(),"role",user.role()));
 }
}
