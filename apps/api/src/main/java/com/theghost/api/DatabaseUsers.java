package com.theghost.api;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.userdetails.User;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class DatabaseUsers implements UserDetailsService, ApplicationRunner {
 private final JdbcTemplate db;
 private final PasswordEncoder encoder;
 private final String bootstrapPassword;
 public DatabaseUsers(JdbcTemplate db, PasswordEncoder encoder,
     @Value("${ghost.bootstrap-password:}") String bootstrapPassword) {
  this.db=db;this.encoder=encoder;this.bootstrapPassword=bootstrapPassword;
 }
 @Override public void run(ApplicationArguments args) {
  Integer count=db.queryForObject("SELECT COUNT(*) FROM ghost_users WHERE username='admin'",Integer.class);
  if(count==0){
   if(bootstrapPassword==null||bootstrapPassword.length()<16)
    throw new IllegalStateException("GHOST_BOOTSTRAP_PASSWORD must be 16+ characters for first bootstrap");
   db.update("INSERT INTO ghost_users(username,password_hash,role) VALUES ('admin',?,'ADMIN') ON CONFLICT DO NOTHING",
       encoder.encode(bootstrapPassword));
  }
 }
 @Override public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
  var users=db.query("SELECT username,password_hash,role,enabled FROM ghost_users WHERE username=?",
   (rs,n)->User.withUsername(rs.getString("username")).password(rs.getString("password_hash"))
     .roles(rs.getString("role")).disabled(!rs.getBoolean("enabled")).build(),username);
  if(users.isEmpty())throw new UsernameNotFoundException("Unknown user");
  return users.get(0);
 }
}
