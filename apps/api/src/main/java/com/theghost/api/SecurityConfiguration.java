package com.theghost.api;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.security.config.annotation.web.builders.HttpSecurity;


import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.security.crypto.password.PasswordEncoder;

import org.springframework.security.web.SecurityFilterChain;
import org.springframework.security.web.authentication.UsernamePasswordAuthenticationFilter;
import org.springframework.security.web.csrf.HttpSessionCsrfTokenRepository;
import org.springframework.security.web.authentication.HttpStatusEntryPoint;
import org.springframework.security.web.savedrequest.NullRequestCache;
@Configuration
public class SecurityConfiguration {
 private final SecurityAudit audit;
 private final LoginAttemptGuard attempts;
 public SecurityConfiguration(SecurityAudit audit, LoginAttemptGuard attempts) {
  this.audit = audit;
  this.attempts = attempts;
 }
 @Bean SecurityFilterChain securityFilterChain(HttpSecurity http) throws Exception {
  return http
   .addFilterBefore(new LoginRateLimitFilter(attempts), UsernamePasswordAuthenticationFilter.class)
   .csrf(csrf -> csrf.csrfTokenRepository(new HttpSessionCsrfTokenRepository()))
   .requestCache(cache -> cache.requestCache(new NullRequestCache()))
   .authorizeHttpRequests(auth -> auth
    .requestMatchers(HttpMethod.GET,"/api/v1/health","/api/v1/demo/**","/api/v1/auth/session","/actuator/health").permitAll()
    .requestMatchers("/api/v1/auth/login").permitAll()
    .requestMatchers("/api/v1/auth/logout").authenticated()
    .requestMatchers("/api/v1/admin/**").hasRole("ADMIN")
    .requestMatchers("/api/v1/scenarios/**","/api/v1/engine/**").hasAnyRole("ADMIN","ANALYST")
    .anyRequest().denyAll())
   .exceptionHandling(e -> e.authenticationEntryPoint(new HttpStatusEntryPoint(HttpStatus.UNAUTHORIZED)))
   .formLogin(form -> form.loginProcessingUrl("/api/v1/auth/login")
    .successHandler((req,res,auth) -> {attempts.succeeded(LoginRateLimitFilter.key(req));audit.record(auth.getName(), "LOGIN_SUCCESS", "local");res.setStatus(200);res.setContentType("application/json");res.getWriter().write("{\"authenticated\":true}");})
    .failureHandler((req,res,ex) -> {attempts.failed(LoginRateLimitFilter.key(req));audit.record("anonymous", "LOGIN_FAILED", "local");res.sendError(401);} ))
   .logout(logout -> logout.logoutUrl("/api/v1/auth/logout").invalidateHttpSession(true)
    .clearAuthentication(true).deleteCookies("JSESSIONID")
    .logoutSuccessHandler((req,res,auth) -> {if(auth!=null)audit.record(auth.getName(),"LOGOUT","local");res.setStatus(204);} ))
   .httpBasic(basic -> basic.disable()).build();
 }
 @Bean PasswordEncoder passwordEncoder(){return new BCryptPasswordEncoder();}
}
