---
name: crud
description: 'Sinh trọn module CRUD backend PMIS3 cho một entity: Controller, Service, Repository, DTO, script SQL, hằng VFunction và spec cho frontend. Dùng khi người dùng yêu cầu viết CRUD cho entity kèm mã chức năng.'
---

# PMIS3 CRUD Generator Skill

## Invocation

This skill is triggered when the user wants to generate a full CRUD module for a PMIS3 entity.
Typical triggers: "viết CRUD cho entity X với mã chức năng Y", "generate CRUD for X", "tạo module CRUD entity X".

## Required Inputs

Before starting, confirm you have:
- **Entity class name** — e.g., `SDept`, `GVattuNhom` (must match the `.java` file in `entity/quantri/`)
- **FUNCTIONID (mã chức năng)** — e.g., `02.0102`, `50.01.05`

If either is missing, **ask the user before proceeding**.

---

## Execution Order

Follow these steps **in order**. Complete each step fully before moving to the next.

### Step 1 — Read the Entity

1. Locate the entity file: `src/main/java/com/pmis3/nguon/entity/quantri/{EntityName}.java`
2. Read it fully to extract:
   - Table name (`@Table(name=...)`)
   - Primary key field name + type (`@Id`)
   - Whether it has an `active` (Boolean) field → determines if `toggle-active` endpoint is needed
   - Whether it has a `deleted` (Boolean) field → determines if soft-delete endpoint is needed
   - Whether it has an `orgid` field → determines if org-scoping in queries is needed
   - All field names (for DTO and update logic in service)

### Step 2 — Derive Naming Conventions

From entity class name (e.g., `SDept`), derive:

| Artifact | Example |
|----------|---------|
| Controller class | `SDeptController` |
| Service class | `SDeptService` |
| Repository interface | `SDeptRepository` |
| DTO class | `SDeptDTO` |
| Request mapping path | lowercase, hyphenated, drop prefix → `dept` (from `SDept`) |
| SQL script file | `scripts/insert_q_function_endpoint_{module}.sql` |
| VFunction constant name | `QT_{MODULE_UPPER}` (ask user if unclear) |

**Request mapping path rule**: strip leading `S`/`Q`/`G`/`A` prefix, convert CamelCase to kebab-case.
- `SDept` → `dept`
- `GVattuNhom` → `vattu-nhom`
- `SCompanyType` → `company-type`

### Step 3 — Create the DTO

**Path**: `src/main/java/com/pmis3/nguon/dto/quantri/{EntityName}DTO.java`

Rules:
- Mirror all fields from the entity (use same field names, same types)
- Omit audit fields inherited from `AuditableEntity` (`userCrId`, `userCrDtime`, `userMdfId`, `userMdfDtime`)
- Use Lombok `@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder`
- No `@Nationalized` on DTOs (that's only for entities)
- No validation annotations on DTO (put those on request body if needed)
- If the DTO should expose the creator/modifier **display names**, extend `com.pmis.common.web.dto.AuditDTO` — the library's `DtoEnrichmentAdvice` fills in `userCrName` / `userMdfName` automatically (do not map them manually).

```java
package com.pmis3.nguon.dto.quantri;

import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class {EntityName}DTO {
    // mirror entity fields here
}
```

If exposing creator/modifier display names:

```java
package com.pmis3.nguon.dto.quantri;

import com.pmis.common.web.dto.AuditDTO;
import lombok.*;

@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
public class {EntityName}DTO extends AuditDTO {
    // mirror entity fields here (userCrName/userMdfName are inherited and auto-filled)
}
```

### Step 4 — Create the Repository

**Path**: `src/main/java/com/pmis3/nguon/repository/quantri/{EntityName}Repository.java`

Standard pattern with paginated keyword search:

```java
package com.pmis3.nguon.repository.quantri;

import com.pmis3.nguon.entity.quantri.{EntityName};
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

@Repository
public interface {EntityName}Repository extends JpaRepository<{EntityName}, {PkType}> {

    @Query("SELECT e FROM {EntityName} e WHERE e.orgid = :orgid " +
           "AND (:keyword IS NULL OR LOWER(e.{mainNameField}) LIKE LOWER(CONCAT('%', :keyword, '%'))) " +
           "ORDER BY e.{mainNameField} ASC")
    Page<{EntityName}> searchByOrgidAndKeyword(@Param("orgid") String orgid,
                                               @Param("keyword") String keyword,
                                               Pageable pageable);
}
```

- `{mainNameField}` = the primary name/description field (usually named `*desc`, `*name`, `*ten`)
- If entity has NO `orgid` field, remove the `e.orgid = :orgid` clause and the `orgid` param

### Step 5 — Create the Service

**Path**: `src/main/java/com/pmis3/nguon/service/quantri/{EntityName}Service.java`

**Inject** `GrantedPermissionService` via the constructor (do NOT extend it — it now lives in the shared `pmis3-security-starter` library). Standard CRUD operations:

```java
package com.pmis3.nguon.service.quantri;

import com.pmis3.nguon.dto.quantri.{EntityName}DTO;
import com.pmis3.nguon.entity.quantri.{EntityName};
import com.pmis.common.exception.BadRequestException;
import com.pmis3.nguon.repository.quantri.{EntityName}Repository;
import com.pmis.common.security.service.GrantedPermissionService;
import com.pmis.common.util.MapperUtil;
import com.pmis.common.security.util.SessionUtil;
import com.pmis.common.util.StringUtil;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
@Slf4j
public class {EntityName}Service {

    private final {EntityName}Repository repository;
    private final MapperUtil mapperUtil;
    private final GrantedPermissionService grantedPermissionService;

    // GET - paginated list
    public Page<{EntityName}DTO> getList(String orgid, String keyword, int page, int size) {
        grantedPermissionService.orgGrantedForUserToRead(orgid);
        Pageable pageable = PageRequest.of(page, size);
        String kw = StringUtil.checkNullOrEmpty(keyword) ? null : keyword;
        return repository.searchByOrgidAndKeyword(orgid, kw, pageable)
                .map(e -> mapperUtil.convertToDto(e, {EntityName}DTO.class));
    }

    // GET - single by ID
    public {EntityName}DTO getById(String orgid, {PkType} id) {
        grantedPermissionService.orgGrantedForUserToRead(orgid);
        {EntityName} entity = repository.findById(id)
                .orElseThrow(() -> new BadRequestException("Không tìm thấy {entityLabel} với mã: " + id));
        // org-check if entity has orgid
        if (!orgid.equalsIgnoreCase(entity.getOrgid())) {
            throw new BadRequestException("{EntityLabel} không thuộc đơn vị này.");
        }
        return mapperUtil.convertToDto(entity, {EntityName}DTO.class);
    }

    // POST - create
    @Transactional
    public {EntityName}DTO create(String orgid, {EntityName}DTO dto) {
        grantedPermissionService.orgGrantedForUserToWrite(orgid);
        // Add PK uniqueness check if PK is user-provided (not @GeneratedValue)
        if (repository.existsById(dto.get{PkField}())) {
            throw new BadRequestException("Mã đã tồn tại: " + dto.get{PkField}());
        }
        {EntityName} entity = mapperUtil.convertToEntity(dto, {EntityName}.class);
        entity.setOrgid(orgid);
        if (entity.getActive() == null) entity.setActive(true);
        {EntityName} saved = repository.save(entity);
        log.info("{EntityLabel} '{}' được tạo bởi: {}", saved.get{PkField}(), SessionUtil.getCurrentUserId());
        return mapperUtil.convertToDto(saved, {EntityName}DTO.class);
    }

    // PUT - update
    @Transactional
    public {EntityName}DTO update(String orgid, {PkType} id, {EntityName}DTO dto) {
        grantedPermissionService.orgGrantedForUserToWrite(orgid);
        {EntityName} existing = repository.findById(id)
                .orElseThrow(() -> new BadRequestException("Không tìm thấy {entityLabel} với mã: " + id));
        if (!orgid.equalsIgnoreCase(existing.getOrgid())) {
            throw new BadRequestException("{EntityLabel} không thuộc đơn vị này.");
        }
        // Update mutable fields manually — do NOT overwrite PK or orgid
        // Set each non-PK, non-orgid field from dto:
        // existing.set{Field}(dto.get{Field}());
        // existing.set{Field2}(dto.get{Field2}());
        existing.setOrgid(orgid); // preserve orgid
        {EntityName} saved = repository.save(existing);
        log.info("{EntityLabel} '{}' được cập nhật bởi: {}", saved.get{PkField}(), SessionUtil.getCurrentUserId());
        return mapperUtil.convertToDto(saved, {EntityName}DTO.class);
    }

    // PATCH - toggle active (only if entity has `active` field)
    @Transactional
    public {EntityName}DTO toggleActive(String orgid, {PkType} id, boolean active) {
        grantedPermissionService.orgGrantedForUserToWrite(orgid);
        {EntityName} entity = repository.findById(id)
                .orElseThrow(() -> new BadRequestException("Không tìm thấy {entityLabel} với mã: " + id));
        if (!orgid.equalsIgnoreCase(entity.getOrgid())) {
            throw new BadRequestException("{EntityLabel} không thuộc đơn vị này.");
        }
        entity.setActive(active);
        {EntityName} saved = repository.save(entity);
        log.info("{EntityLabel} '{}' được {} bởi: {}",
                saved.get{PkField}(), active ? "kích hoạt" : "vô hiệu hóa", SessionUtil.getCurrentUserId());
        return mapperUtil.convertToDto(saved, {EntityName}DTO.class);
    }

    // DELETE (only if entity has `deleted` field — soft delete; otherwise hard delete)
    @Transactional
    public void delete(String orgid, {PkType} id) {
        grantedPermissionService.orgGrantedForUserToWrite(orgid);
        {EntityName} entity = repository.findById(id)
                .orElseThrow(() -> new BadRequestException("Không tìm thấy {entityLabel} với mã: " + id));
        if (!orgid.equalsIgnoreCase(entity.getOrgid())) {
            throw new BadRequestException("{EntityLabel} không thuộc đơn vị này.");
        }
        // Soft delete: entity.setDeleted(true); repository.save(entity);
        // Hard delete:
        repository.delete(entity);
        log.info("{EntityLabel} '{}' được xóa bởi: {}", id, SessionUtil.getCurrentUserId());
    }
}
```

**Service adaptation rules**:
- If entity has **no** `orgid` field: remove org-check blocks and use `grantedPermissionService.orgGrantedForUserToRead/Write(orgid)` only for permission, skip ownership check.
- If entity has **no** `active` field: skip `toggleActive` method entirely.
- If entity uses `@GeneratedValue` for PK (auto-generated): skip the `existsById` check in `create`, and set PK to `null` before save.
- If PK is user-provided (String/manual): keep `existsById` check.
- For `update()`: always set fields manually with setters — `MapperUtil` has no `updateEntity` method. Use the entity fields extracted in Step 1 to determine which fields to set (exclude PK and `orgid`).

**Permission notes (new architecture)**:
- `GrantedPermissionService` lives in the shared library at `com.pmis.common.security.service.GrantedPermissionService`. Services **inject** it (constructor / `@RequiredArgsConstructor`); they do **not** extend it.
- Available check methods (all auto-bypass `ROLE_SUPER_ADMIN` internally and throw `ForbiddenException` when denied):
  `orgGrantedForUserToRead(orgid)` / `orgGrantedForUserToWrite(orgid)`, `plantGrantedForUserToRead/Write(plantid)`, `siteGrantedForUserToRead/Write(siteid)`, and `funcGrantedForUser(func, EPermission)` (returns `boolean`).
- There is **no** `checkSuperAdminRole()` in the library. If an explicit super-admin check is needed, declare a private helper:
  `SessionUtil.getRolesOfCurrentUser().contains(ERoleName.ROLE_SUPER_ADMIN.name())` (`SessionUtil` from `com.pmis.common.security.util`, `ERoleName` from `com.pmis.common.constant`).
- **Optional alternative** to manual calls: annotate the service method instead, e.g. `@RequiresOrgWrite public {EntityName}DTO update(String orgid, ...)`. The library's `PermissionAspect` reads the parameter named `orgid` by default (`@RequiresOrgRead/Write`, `@RequiresPlantRead/Write` → `plantid`, `@RequiresSiteRead/Write` → `siteid`; from `com.pmis.common.security.annotation`). Manual calls remain the primary documented pattern here.
- Regardless of approach, the library's `FunctionAuthorizedInterceptor` **also** enforces function-level + org-level permission automatically for every non-whitelisted endpoint, based on the `Q_FUNCTION_ENDPOINT` table + the `orgid` header — so the SQL insert in Step 7 is still required.

### Step 6 — Create the Controller

**Path**: `src/main/java/com/pmis3/nguon/controller/{EntityName}Controller.java`

```java
package com.pmis3.nguon.controller;

import com.pmis3.nguon.dto.quantri.{EntityName}DTO;
import com.pmis.common.web.dto.response.ApiResponse;
import com.pmis3.nguon.service.quantri.{EntityName}Service;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.media.Content;
import io.swagger.v3.oas.annotations.media.Schema;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/{requestMappingPath}")
@RequiredArgsConstructor
@Tag(name = "{EntityName} - {Vietnamese module description}", description = "API quản lý {entityLabel}.")
public class {EntityName}Controller {

    private final {EntityName}Service service;

    @Operation(summary = "Lấy danh sách {entityLabel}", description = "Phân trang, tìm kiếm theo từ khóa.")
    @ApiResponses(value = {
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "Thành công",
                    content = @Content(mediaType = "application/json", schema = @Schema(implementation = ApiResponse.class))),
            @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "403", description = "Không có quyền truy cập")
    })
    @GetMapping
    public ResponseEntity<ApiResponse> getList(
            @RequestHeader("orgid") String orgid,
            @RequestParam(required = false) String keyword,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Page<{EntityName}DTO> result = service.getList(orgid, keyword, page, size);
        return ResponseEntity.ok(ApiResponse.builder()
                .data(result.getContent())
                .count(result.getTotalElements())
                .countPage((long) result.getTotalPages())
                .build());
    }

    @Operation(summary = "Lấy chi tiết {entityLabel}")
    @GetMapping("/detail")
    public ResponseEntity<ApiResponse> getById(
            @RequestHeader("orgid") String orgid,
            @RequestParam {PkType} {pkParam}) {
        return ResponseEntity.ok(ApiResponse.success(service.getById(orgid, {pkParam})));
    }

    @Operation(summary = "Tạo mới {entityLabel}")
    @PostMapping
    public ResponseEntity<ApiResponse> create(
            @RequestHeader("orgid") String orgid,
            @Valid @RequestBody {EntityName}DTO dto) {
        return ResponseEntity.ok(ApiResponse.success("Tạo {entityLabel} thành công.", service.create(orgid, dto)));
    }

    @Operation(summary = "Cập nhật {entityLabel}")
    @PutMapping
    public ResponseEntity<ApiResponse> update(
            @RequestHeader("orgid") String orgid,
            @RequestParam {PkType} {pkParam},
            @Valid @RequestBody {EntityName}DTO dto) {
        return ResponseEntity.ok(ApiResponse.success("Cập nhật {entityLabel} thành công.", service.update(orgid, {pkParam}, dto)));
    }

    // Include ONLY IF entity has `active` field:
    @Operation(summary = "Kích hoạt / Vô hiệu hóa {entityLabel}")
    @PatchMapping("/toggle-active")
    public ResponseEntity<ApiResponse> toggleActive(
            @RequestHeader("orgid") String orgid,
            @RequestParam {PkType} {pkParam},
            @RequestParam boolean active) {
        return ResponseEntity.ok(ApiResponse.success(
                active ? "Kích hoạt thành công." : "Vô hiệu hóa thành công.",
                service.toggleActive(orgid, {pkParam}, active)));
    }

    // Include ONLY IF delete is required:
    @Operation(summary = "Xóa {entityLabel}")
    @DeleteMapping
    public ResponseEntity<ApiResponse> delete(
            @RequestHeader("orgid") String orgid,
            @RequestParam {PkType} {pkParam}) {
        service.delete(orgid, {pkParam});
        return ResponseEntity.ok(ApiResponse.success("Xóa {entityLabel} thành công."));
    }
}
```

**Controller rules**:
- `@RequestParam` everywhere — **never** `@PathVariable`
- Always `@RequestHeader("orgid") String orgid`
- Skip `toggleActive` endpoint if entity has no `active` field
- Skip `delete` endpoint unless user explicitly asks for it
- `{pkParam}` = PK field name in camelCase (e.g., `deptid`, `id`, `uomid`)

### Step 7 — Generate SQL Script

**Path**: `scripts/insert_q_function_endpoint_{module}.sql`

Generate one INSERT per endpoint created. Standard set:

```sql
-- =============================================
-- Q_FUNCTION_ENDPOINT: {Vietnamese module name} ({FUNCTIONID})
-- =============================================

-- GET danh sach {entityLabel}
INSERT INTO Q_FUNCTION_ENDPOINT (FUNCTIONID, ENDPOINT, METHOD, VAI_TRO)
VALUES ('{FUNCTIONID}', '{path}', 'GET', 'READ');

-- GET chi tiet {entityLabel}
INSERT INTO Q_FUNCTION_ENDPOINT (FUNCTIONID, ENDPOINT, METHOD, VAI_TRO)
VALUES ('{FUNCTIONID}', '{path}/detail', 'GET', 'READ');

-- POST tao moi {entityLabel}
INSERT INTO Q_FUNCTION_ENDPOINT (FUNCTIONID, ENDPOINT, METHOD, VAI_TRO)
VALUES ('{FUNCTIONID}', '{path}', 'POST', 'CREATE');

-- PUT cap nhat {entityLabel}
INSERT INTO Q_FUNCTION_ENDPOINT (FUNCTIONID, ENDPOINT, METHOD, VAI_TRO)
VALUES ('{FUNCTIONID}', '{path}', 'PUT', 'EDIT');

-- PATCH toggle active (if applicable)
INSERT INTO Q_FUNCTION_ENDPOINT (FUNCTIONID, ENDPOINT, METHOD, VAI_TRO)
VALUES ('{FUNCTIONID}', '{path}/toggle-active', 'PATCH', 'EDIT');

-- DELETE xoa (if applicable)
INSERT INTO Q_FUNCTION_ENDPOINT (FUNCTIONID, ENDPOINT, METHOD, VAI_TRO)
VALUES ('{FUNCTIONID}', '{path}', 'DELETE', 'DELETE');
```

VAI_TRO mapping:
| HTTP Method | VAI_TRO |
|-------------|---------|
| GET | READ |
| POST | CREATE |
| PUT / PATCH | EDIT |
| DELETE | DELETE |

ENDPOINT value = `@RequestMapping` value **without leading slash**.

### Step 8 — Update VFunction.java

**Path**: `src/main/java/com/pmis3/nguon/constant/VFunction.java`

Add a constant for the new FUNCTIONID. Read the file first, then add:

```java
public static final String {CONSTANT_NAME} = "{FUNCTIONID}"; // {Vietnamese module description}
```

Constant name convention: `QT_{MODULE_UPPER}` — derive from the entity/module name.
- `SDept` + `02.0102` → `QT_DEPT = "02.0102";`
- Ask the user if unclear.

### Step 9 — Generate Frontend Spec

Create the FE spec document at:
`../pmis3-nguon-frontend/docs/FE_{MODULE_UPPER}_SPEC.md`

Follow the `pmis3-frontend-spec` skill format exactly (8 sections). Base all endpoint examples on the actual controller you just created. If the frontend docs folder does not exist, skip this step and notify the user.

---

## Checklist Before Reporting Done

- [ ] Entity file read and fields extracted
- [ ] DTO created in `dto/quantri/`
- [ ] Repository created in `repository/quantri/`
- [ ] Service created in `service/quantri/` (injects `GrantedPermissionService` from `com.pmis.common.security.service`)
- [ ] Controller created in `controller/` (`@RequestParam` only, `orgid` header on all endpoints)
- [ ] SQL script created in `scripts/`
- [ ] `VFunction.java` updated with new constant
- [ ] FE spec document created in `../pmis3-nguon-frontend/docs/` (or user notified if skipped)

---

## Common Adaptation Decisions

| Condition | Action |
|-----------|--------|
| Entity has no `orgid` field | Skip org-ownership checks; keep permission check only |
| Entity PK is `@GeneratedValue` (Long/auto) | Set PK to `null` in create; skip `existsById` check |
| Entity PK is user-provided (String) | Keep `existsById` uniqueness check in create |
| Entity has no `active` field | Skip `toggleActive` method and endpoint |
| Entity has `deleted` field | Use soft-delete in `delete()` instead of hard delete |
| Entity has tree/parent structure | Add a `/tree` GET endpoint returning a recursive tree (see SDept pattern) |
| User explicitly requests delete | Add `delete` endpoint and service method |
| User says "no delete" | Skip delete entirely |
