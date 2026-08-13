---
name: pitfalls
description: '10 lỗi hay mắc khi làm backend PMIS3 và cách tránh. Đọc khi debug hoặc review code backend.'
---

# PMIS3 Common Pitfalls to Avoid

1. **Don't use Hibernate DDL auto**: Schema is managed in SQL Server. Never set `spring.jpa.hibernate.ddl-auto` to `update` or `create`.

2. **Don't bypass audit fields**: Let `AuditEntityListener` handle `USER_CR_ID`, `USER_MDF_ID`, `USER_CR_DTIME`, `USER_MDF_DTIME` automatically.

3. **Don't hardcode user IDs**: Always use `SessionUtil.getCurrentUserId()`.

4. **Don't ignore soft deletes**: Check `DELETED` flags before queries (e.g., `QUser`).

5. **Don't expose entities in APIs**: Always use DTOs with `MapperUtil` for conversion.

6. **Don't forget timezone**: Jackson is configured for GMT+7.

7. **Don't skip password validation**: Use `StringUtil.isValidPassword()` for registration and password changes.

8. **Don't mix authentication types**: Respect `QUser.authenType` field (internal vs EVNID).

9. **Don't set ID to 0 for auto-generated IDs**: Use `null` for new entities with `@GeneratedValue(strategy = GenerationType.IDENTITY)` - setting ID to `0L` causes "Row was already updated or deleted" errors.

10. **Don't forget @Nationalized on string fields**: SQL Server columns are `NVARCHAR`, so always use `@Nationalized` on String fields to prevent "The conversion from varchar to NCHAR is unsupported" errors.

11. **Don't extend `GrantedPermissionService`**: it lives in the library now — **inject** it (`private final GrantedPermissionService grantedPermissionService;` from `com.pmis.common.security.service`). There is no `checkSuperAdminRole()`; the check methods already auto-bypass `ROLE_SUPER_ADMIN`.

12. **Don't recreate library code in the host**: `MapperUtil`, `SessionUtil`, the `Q_*`/`S_*` admin entities, `AuditableEntity`/`AuditEntityListener`, `ApiResponse`, `AuditDTO`, exceptions, and Spring Security config all come from `pmis3-security-starter` (`com.pmis.common.*`). Import them; don't duplicate. The host has no `util` package.

13. **Don't add a `SecurityFilterChain` / `RestTemplate` / `ControllerAdvice` unless overriding**: these are auto-configured by the library (`@ConditionalOnMissingBean`). Define your own bean only to intentionally override.
