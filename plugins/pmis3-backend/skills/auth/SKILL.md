---
name: auth
description: 'Xác thực và phân quyền backend PMIS3: JWT, xác thực nhiều lớp, TFA, SessionUtil, GrantedPermissionService và các phương thức kiểm tra quyền theo đơn vị, nhà máy, tổ máy.'
---

# PMIS3 Authentication & Authorization

## Multi-Level Authorization System

The system implements sophisticated multi-level authorization:

1. **Function Level**: `QFunction.ISPUBLIC`, `ISLOGIN` flags
2. **Role Level**: `QPqfunctionRole` entity (R_VIEW, R_CREATE, R_EDIT, R_DELETE)
3. **User Level**: `QPqfunctionUser` entity (direct user permission overrides)
4. **Organization Level**: `QOrgGrantUser`, `QOrgGrantRole`
5. **Plant Level**: `QPlantGrantUser`, `QPlantGrantRole`
6. **Site Level** (công trình): `QSiteGrantUser`, `QSiteGrantRole`
7. **Endpoint Level**: `QFunctionEndpoint` (maps functions to HTTP endpoints)

> All of these entities and the permission logic now live in the shared library `pmis3-security-starter` (`com.pmis.common.security.*`). Function-level + organization-level checks run **automatically** for every non-whitelisted endpoint via the library's `FunctionAuthorizedInterceptor` (using `Q_FUNCTION_ENDPOINT` + the `orgid` header). Org/plant/site checks can also be invoked explicitly in services (see below).

## JWT Configuration

- **Header**: `Authorization: Bearer <token>`
- **Access Token**: 30 minutes (1800000ms)
- **Refresh Token**: 24 hours (86400000ms)
- **RSA Keys**: Configured via `JWT_PUBLIC_KEY` and `JWT_PRIVATE_KEY` environment variables

## Two-Factor Authentication (TFA)

`QUser` entity includes built-in TFA support:
- `enableTfa` - Flag to enable TFA
- `tfaOtp` - 6-digit OTP code
- `tfaOtpExpireAt` - OTP expiration timestamp
- `tfaOtpCnt` - OTP attempt counter
- `emailOtp` - Flag for email-based OTP
- `tfaDeviceStart` - Device-based TFA start time

## Device Tracking

`QUserDevice` tracks user devices:
- Device ID, type, browser, OS
- Notification tokens
- Refresh token status per device
- Links to `QRefreshToken` for token management

## SessionUtil Integration

When implementing services/controllers, use `SessionUtil`:
```java
// Get current authenticated user ID
String userId = SessionUtil.getCurrentUserId();

// Check if user is authenticated
boolean isAuth = SessionUtil.isAuthenticated();

// Get user roles
List<String> roles = SessionUtil.getRolesOfCurrentUser();
```

**Important**: `SessionUtil` (`com.pmis.common.security.util.SessionUtil`, static) and `CustomUserDetails` (`com.pmis.common.security.model.CustomUserDetails`) are both provided by the library — the `JwtAuthenticationFilter` populates the SecurityContext automatically. You do not implement them in this service.

## Organization-Level Authorization Rules

**CRITICAL**: Most APIs use organization-level permission checking instead of SUPER_ADMIN role check.

### Authorization Pattern

1. **Request Header**: Every request must include `orgid` in the header
   ```java
   @RequestHeader("orgid") String orgid
   ```

2. **Permission Check in Service Layer**:
   - **GET requests** (read operations): Use `orgGrantedForUserToRead(orgid)`
   - **Non-GET requests** (POST, PUT, DELETE, PATCH - write operations): Use `orgGrantedForUserToWrite(orgid)`

3. **Service Implementation Pattern** (inject, do NOT extend):
   ```java
   import com.pmis.common.security.service.GrantedPermissionService;

   @Service
   @RequiredArgsConstructor
   public class YourService {

       private final GrantedPermissionService grantedPermissionService;

       // For GET/read operations
       public SomeDTO getById(String orgid, String id) {
           grantedPermissionService.orgGrantedForUserToRead(orgid);  // Check read permission
           // ... business logic
       }

       // For POST/PUT/DELETE/PATCH - write operations
       @Transactional
       public SomeDTO create(String orgid, SomeDTO dto) {
           grantedPermissionService.orgGrantedForUserToWrite(orgid);  // Check write permission
           // ... business logic
       }
   }
   ```
   Or annotate the method instead: `@RequiresOrgRead` / `@RequiresOrgWrite` (also `@RequiresPlant*` / `@RequiresSite*`), from `com.pmis.common.security.annotation`.

4. **Controller Implementation Pattern**:
   ```java
   @RestController
   @RequestMapping("/your-endpoint")
   @RequiredArgsConstructor
   public class YourController {
       private final YourService yourService;

       @GetMapping
       public ResponseEntity<ApiResponse> getAll(
               @RequestHeader("orgid") String orgid,
               @RequestParam(required = false) String keyword) {
           return ResponseEntity.ok(ApiResponse.success(
               yourService.getAll(orgid, keyword)));
       }

       @PostMapping
       public ResponseEntity<ApiResponse> create(
               @RequestHeader("orgid") String orgid,
               @Valid @RequestBody SomeDTO dto) {
           return ResponseEntity.ok(ApiResponse.success(
               yourService.create(orgid, dto)));
       }
   }
   ```

### SUPER_ADMIN

All `GrantedPermissionService` check methods **auto-bypass** `ROLE_SUPER_ADMIN` — no manual check needed for normal org/plant/site-scoped APIs. There is **no** `checkSuperAdminRole()` in the library. For an API that must be SUPER_ADMIN-only, check explicitly:
```java
if (!SessionUtil.getRolesOfCurrentUser().contains(ERoleName.ROLE_SUPER_ADMIN.name())) {
    throw new ForbiddenException("...");
}
```

### Permission Methods (inject `GrantedPermissionService`)

From `com.pmis.common.security.service.GrantedPermissionService`. Check methods throw `ForbiddenException` when denied:

- `orgGrantedForUserToRead(String orgid)` / `orgGrantedForUserToWrite(String orgid)` - organization
- `plantGrantedForUserToRead(String plantid)` / `plantGrantedForUserToWrite(String plantid)` - plant
- `siteGrantedForUserToRead(String siteid)` / `siteGrantedForUserToWrite(String siteid)` - site (công trình)
- `funcGrantedForUser(String func, EPermission permission)` - function permission (returns `boolean`)

## What the library provides vs. what the host does

**Provided by `pmis3-security-starter` (do NOT re-implement):**
- `CustomUserDetails`, `SessionUtil`, `JwtAuthenticationFilter`, `JwtTokenProvider`, `RSAKeyConfig`
- Default `SecurityFilterChain` (stateless + JWT) — overridable by declaring your own `SecurityFilterChain` bean
- `FunctionAuthorizedInterceptor` (function + org enforcement), `GrantedPermissionService`, `PermissionAspect`
- `CustomUserDetailsService` (loads `QUser`)

**Host responsibilities:**
1. **Config**: set `app.jwt.*` (header, expiration, RSA keys), `app.cookie.*`, and `pmis.security.*` (context-path, white-list) in `application.yml`
2. **Combined scan**: include library packages in `@EntityScan` / `@EnableJpaRepositories` / `@ComponentScan`
3. **Synced admin tables**: the service DB must contain the `Q_*` / `S_*` admin tables (same structure, own data)
4. **TFA flow** (if used): leverage `QUser.enableTfa` and related fields
5. **Track login/logout**: use the `QLoginout` entity for the audit trail
6. **Q_FUNCTION_ENDPOINT rows**: insert a row per new endpoint so the interceptor can authorize it
