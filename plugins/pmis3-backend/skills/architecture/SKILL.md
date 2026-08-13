---
name: architecture
description: 'Kiến trúc backend PMIS3: cấu trúc package, quy ước đặt tên entity Q_* và S_*, khóa phức hợp, pattern audit, phân cấp đơn vị. Đọc trước khi thêm entity hoặc module backend mới.'
---

# PMIS3 Architecture

## Project Overview

PMIS3 Backend (quantri) - Spring Boot 4.1.0, Java 17, SQL Server. Consumes the shared starter library `com.pmis:pmis3-security-starter` (root package `com.pmis.common.*`) which provides admin entities, permission checks, JWT security, and utils. Controllers, services, and repositories are implemented incrementally.

**Key Technologies**: Spring Boot 4.1.0, Java 17, SQL Server, Spring Security + JWT, Spring Data JPA (database-first), Lombok, ModelMapper, SpringDoc OpenAPI

## Package Structure (Base: com.pmis3.nguon)

```
com.pmis3.nguon/                        # HOST service (business code only)
├── Pmis3NguonBackendQuantriApplication.java   # @SpringBootApplication + combined scan
├── entity/                             # HOST business entities (extend library AuditableEntity)
├── controller/                         # REST controllers
├── service/                            # Business logic services (inject GrantedPermissionService)
├── repository/                         # Spring Data JPA repositories
├── dto/                                # Data Transfer Objects
├── model/                              # Plain models
├── constant/                           # e.g. VFunction (FUNCTIONID constants)
└── config/                             # Host-specific config (RestTemplateConfig, SeaweedProperties, ...)
```

> The host has **no `util` package** — util classes come from the library. The `@SpringBootApplication` declares a **combined scan** so both host and library packages load:
> ```java
> @ComponentScan({"com.pmis3.nguon", "com.pmis.common.util"})
> @EntityScan({"com.pmis3.nguon.entity", "com.pmis.common.security.entity"})
> @EnableJpaRepositories({"com.pmis3.nguon.repository", "com.pmis.common.security.repository"})
> ```

### From the library (`com.pmis.common.*`) — do not recreate here
```
com.pmis.common/
├── util/                  # MapperUtil, SessionUtil(*see security), StringUtil, DateUtil, FileUtil, EncryptionUtil, CookieUtil
├── constant/              # EPermission, ERoleName, VSecurityConstants, EMessageType
├── exception/             # AppException, BadRequestException, ForbiddenException, ...
├── web/                   # ApiResponse, AuditDTO, ControllerAdvice, Cors/Gson/Redis/Swagger config
├── persistence/           # IGenericService, SoftDeleteService(+Impl/Factory)
└── security/
    ├── entity/            # Admin entities: QUser, QRole, QFunction, QFunctionEndpoint, QUserRole,
    │   │                  #   QPqfunctionUser/Role, QOrgGrantUser/Role, QPlantGrantUser/Role,
    │   │                  #   QSiteGrantUser/Role, SOrganization, SPlant, SSite
    │   └── base/          # AuditableEntity, AuditEntityListener
    ├── util/              # SessionUtil, JwtTokenProvider, DatabaseUtil
    ├── service/           # GrantedPermissionService, PermissionCacheService, CustomUserDetailsService
    ├── web/               # JwtAuthenticationFilter, FunctionAuthorizedInterceptor, DtoEnrichmentAdvice
    ├── aspect/            # PermissionAspect
    └── annotation/        # @CurrentUser, @RequiresOrg/Plant/SiteRead/Write
```

## Database-First Approach

This project uses an **existing SQL Server database** (PMIS_UPGRADE). Hibernate DDL mode is `none`:
- Do NOT use `spring.jpa.hibernate.ddl-auto=update` or `create`
- All schema changes must be done directly in SQL Server
- Entities reflect the existing database schema
- Use `@Table(name="...")` annotations to map to existing tables

## Entity Naming Conventions

- **Q_\* tables**: Core management (quantri) entities
  - `Q_USER`, `Q_ROLE`, `Q_FUNCTION` - Security core
  - `Q_USER_ROLE`, `Q_USER_DEVICE` - User relationships
  - `Q_REFRESH_TOKEN`, `Q_LOGINOUT` - Authentication tracking
  - `Q_*_GRANT_*` - Organization/plant access grants

- **S_\* tables**: System/reference data (static data)
  - `S_ORGANIZATION`, `S_PLANT`, `S_DEPT` - Organizational structure
  - `S_PROVINCE`, `S_BASIN` - Geographic data
  - `S_COMMON`, `S_LIST_ALL` - Configuration/lookup data
  - `S_EVNID_CFG` - External authentication config

## Composite Key Pattern

Many entities use composite keys with `@Embeddable` ID classes:
- `QUserRoleId` (USERID + ROLEID)
- `QPqfunctionRoleId` (FUNCTIONID + ROLEID)
- `QFunctionEndpointId` (FUNCTIONID + ENDPOINT + METHOD + VAI_TRO)

When creating repositories for these entities, use the composite key class:
```java
public interface QUserRoleRepository extends JpaRepository<QUserRole, QUserRoleId> { }
```

## Audit Pattern

**All auditable entities** must extend the library base class `com.pmis.common.security.entity.base.AuditableEntity`:
```java
import com.pmis.common.security.entity.base.AuditableEntity;
import com.pmis.common.security.entity.base.AuditEntityListener;

@Entity
@EntityListeners(AuditEntityListener.class)
public class YourEntity extends AuditableEntity { }
```

This automatically populates:
- `USER_CR_ID` / `USER_CR_DTIME` - Creator and creation time
- `USER_MDF_ID` / `USER_MDF_DTIME` - Last modifier and modification time

The `AuditEntityListener` extracts the current user from `SecurityContext` via `SessionUtil.getCurrentUserId()`.

## Multi-Tenancy and Organizational Structure

### Hierarchical Organization

`SOrganization` is self-referencing via `ORGID_PARENT`:
- Supports multiple organizational levels
- `ISTCT` flag marks headquarters
- `ISDEFAULT` flag marks default organization
- Each organization can have app URLs and auto-login codes

### Plant Management

`SPlant` entities are associated with organizations:
- Track capacity (`PDESSUM`), fuel type, unit count
- Regional basin association
- HES integration via `URL_WS_EVNHES`
- Coal plant flag (`ISCOALPLANT`)

### Access Grants

When implementing authorization (all grant entities are in the library `com.pmis.common.security.entity`):
- **Organization Access**: `QOrgGrantUser` / `QOrgGrantRole` → `grantedPermissionService.orgGrantedForUserTo{Read,Write}`
- **Plant Access**: `QPlantGrantUser` / `QPlantGrantRole` → `...plantGrantedForUserTo{Read,Write}`
- **Site Access** (công trình): `QSiteGrantUser` / `QSiteGrantRole` → `...siteGrantedForUserTo{Read,Write}`
- Users can have access to organizations/plants/sites beyond their primary assignment

## Function and Menu System

### QFunction Hierarchy

`QFunction` represents both menus and functions:
- **Hierarchical structure** via `FUNCTION_PARENT_ID`
- **Menu vs Function**: `ISMENU` flag
- **Public access**: `ISPUBLIC` flag (no auth required)
- **Login required**: `ISLOGIN` flag (auth required, no role check)
- **Mobile support**: `ISMOBILE` flag + `URL_MOBILE`
- **External functions**: `ISEXTERNAL` flag
- **Icon and colors**: Customizable per function

When implementing menu APIs:
- Return hierarchical structure (parent-child relationships)
- Filter by user permissions (`QPqfunctionUser`, `QPqfunctionRole`)
- Consider organization/plant grants
- Separate mobile vs web menus if needed

## Repository Implementation

1. **For standard entities**:
   ```java
   public interface UserRepository extends JpaRepository<QUser, String> {
       // Custom queries
   }
   ```

2. **For composite key entities**:
   ```java
   public interface UserRoleRepository extends JpaRepository<QUserRole, QUserRoleId> {
       // Custom queries
   }
   ```

3. **Use existing entity relationships** - Many-to-many relationships via join entities are already defined
