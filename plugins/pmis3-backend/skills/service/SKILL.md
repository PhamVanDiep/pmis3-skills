---
name: service
description: 'Viết service layer backend PMIS3: kiểm tra quyền, gán trường audit, xóa mềm, giao dịch.'
---

# PMIS3 Service Layer Patterns

## Core Pattern: Inject GrantedPermissionService

`GrantedPermissionService` now lives in the shared library (`com.pmis.common.security.service`). Services **inject** it via constructor — they do **NOT** extend it:

```java
import com.pmis.common.security.service.GrantedPermissionService;
import com.pmis.common.util.MapperUtil;

@Service
@RequiredArgsConstructor
public class YourService {

    private final SomeRepository repository;
    private final MapperUtil mapperUtil;
    private final GrantedPermissionService grantedPermissionService;

    // For GET/read operations
    public SomeDTO getById(String orgid, String id) {
        grantedPermissionService.orgGrantedForUserToRead(orgid);
        SomeEntity entity = repository.findByOrgidAndId(orgid, id);
        // ... business logic
    }

    // For POST/PUT/DELETE/PATCH - write operations
    @Transactional
    public SomeDTO create(String orgid, SomeDTO dto) {
        grantedPermissionService.orgGrantedForUserToWrite(orgid);
        SomeEntity entity = mapperUtil.convertToEntity(dto, SomeEntity.class);
        entity.setOrgid(orgid);
        // ... business logic
    }
}
```

**Alternative (annotations):** instead of manual calls you may annotate the method — the library's `PermissionAspect` enforces it. The annotation reads the named method parameter (defaults: `orgid` / `plantid` / `siteid`):

```java
import com.pmis.common.security.annotation.RequiresOrgWrite;

@RequiresOrgWrite                      // reads parameter "orgid"
@Transactional
public SomeDTO create(String orgid, SomeDTO dto) { ... }
```

## Service Implementation Rules

1. **Always check audit fields** - Don't manually set USER_CR_ID, USER_MDF_ID, etc. (handled by `AuditEntityListener` from `com.pmis.common.security.entity.base`)
2. **Use `SessionUtil`** (`com.pmis.common.security.util.SessionUtil`, static) to get current user context
3. **Respect soft delete** - Check `DELETED` flags where applicable (e.g., `QUser`)
4. **Use permission checking** - Inject `GrantedPermissionService` and call:
   - `grantedPermissionService.orgGrantedForUserToRead(orgid)` for GET/read operations
   - `grantedPermissionService.orgGrantedForUserToWrite(orgid)` for POST/PUT/DELETE/PATCH operations
5. **Pass `orgid` from controller to service** - All methods should receive `orgid` from `@RequestHeader`
6. **Super-admin** - Check methods already auto-bypass `ROLE_SUPER_ADMIN`. For an explicit super-admin-only API there is no library helper; use `SessionUtil.getRolesOfCurrentUser().contains(ERoleName.ROLE_SUPER_ADMIN.name())` (or a small private helper).

## Permission Methods (inject `GrantedPermissionService`)

From `com.pmis.common.security.service.GrantedPermissionService`. All check methods auto-bypass `ROLE_SUPER_ADMIN` and throw `ForbiddenException` when denied:

- `orgGrantedForUserToRead(String orgid)` / `orgGrantedForUserToWrite(String orgid)` - organization
- `plantGrantedForUserToRead(String plantid)` / `plantGrantedForUserToWrite(String plantid)` - plant
- `siteGrantedForUserToRead(String siteid)` / `siteGrantedForUserToWrite(String siteid)` - site (công trình)
- `funcGrantedForUser(String func, EPermission permission)` - function permission (returns `boolean`)

## SessionUtil Usage

```java
// Get current authenticated user ID
String userId = SessionUtil.getCurrentUserId();

// Check if user is authenticated
boolean isAuth = SessionUtil.isAuthenticated();

// Get user roles
List<String> roles = SessionUtil.getRolesOfCurrentUser();
```

## Use MapperUtil for DTO Conversions

Inject `MapperUtil` (`com.pmis.common.util.MapperUtil`, auto-registered by the library):

```java
// Entity to DTO
SomeDTO dto = mapperUtil.convertToDto(entity, SomeDTO.class);

// DTO to Entity
SomeEntity entity = mapperUtil.convertToEntity(dto, SomeEntity.class);

// List conversion
List<SomeDTO> dtos = mapperUtil.convertToDtoList(entities, SomeDTO.class);
```

## Soft Delete

Use the generic factory from the library (`com.pmis.common.persistence.SoftDeleteServiceFactory`) for entities exposing `setDeleted/setUserDelId/setUserDelDtime`:

```java
private final SoftDeleteServiceFactory softDeleteFactory;

public void delete(Long id) {
    softDeleteFactory.<SomeEntity, Long>getService(SomeEntity.class)
        .softDeleteById(id, SessionUtil.getCurrentUserId());
}
```
