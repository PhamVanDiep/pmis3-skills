---
name: add-api
description: 'Thêm một API endpoint mới vào controller backend PMIS3 sẵn có, tuân thủ đủ quy ước: @RequestParam, header orgid, MapperUtil, GrantedPermissionService, script SQL phân quyền.'
---

# PMIS3 Add API Skill

## Invocation

```
/pmis3-add-api <ControllerFileName> <mô tả API>
```

**Examples:**
- `/pmis3-add-api SCompanyController GET danh sách công ty đang active theo orgid`
- `/pmis3-add-api SDeptController POST tạo phòng ban hàng loạt từ danh sách`
- `/pmis3-add-api GVattuNhomController GET xuất Excel danh sách vật tư nhóm`

If the controller filename or description is missing, **ask before proceeding**.

---

## Required Inputs

| Input | Description | Required |
|-------|-------------|----------|
| `ControllerFileName` | e.g. `SCompanyController` or `SCompanyController.java` | Yes |
| `API description` | Short Vietnamese/English description of what the API does | Yes |
| `FUNCTIONID` | e.g. `02.0102` — for SQL script generation | Ask if not provided |

---

## Execution Steps

### Step 1 — Read Existing Files

> **Architecture note:** Admin/permission/util code now lives in the shared Spring Boot Starter
> library `com.pmis:pmis3-security-starter` (root package `com.pmis.common.*`). The host service
> (base package `com.pmis3.nguon`) consumes it as a dependency and keeps its OWN controllers,
> services, repositories, DTOs, business entities, config, and `com.pmis3.nguon.constant.VFunction`.
> The host no longer has a `util` package — utilities are imported from `com.pmis.common.util.*`.

1. Find the controller: `src/main/java/com/pmis3/nguon/controller/{ControllerName}.java`
2. Read it fully to extract:
   - `@RequestMapping` path (e.g. `/dept`, `/company`)
   - `@Tag` description
   - Service field name and class name (e.g. `deptService`, `SDeptService`)
   - Existing endpoints (to avoid conflicts and understand patterns)
   - DTO class names used in the controller
3. Find and read the service: `src/main/java/com/pmis3/nguon/service/{ServiceName}.java`
4. Find and read the repository: `src/main/java/com/pmis3/nguon/repository/{EntityName}Repository.java`

### Step 2 — Analyze the API Description

Classify the new API based on the description:

| Description keywords | HTTP Method | Permission |
|---------------------|-------------|------------|
| lấy, get, danh sách, chi tiết, tìm, xuất, export | `GET` | `grantedPermissionService.orgGrantedForUserToRead(orgid)` |
| tạo, create, thêm, add, import | `POST` | `grantedPermissionService.orgGrantedForUserToWrite(orgid)` |
| cập nhật, update, sửa | `PUT` | `grantedPermissionService.orgGrantedForUserToWrite(orgid)` |
| kích hoạt, toggle, vô hiệu | `PATCH` | `grantedPermissionService.orgGrantedForUserToWrite(orgid)` |
| xóa, delete | `DELETE` | `grantedPermissionService.orgGrantedForUserToWrite(orgid)` |

Determine:
- **Endpoint path suffix** — derive from description (e.g. "active" → `/active`, "export excel" → `/export-excel`, "by type" → `/by-type`)
- **Method name** — camelCase, verb-first (e.g. `getActiveList`, `createBatch`, `exportToExcel`)
- **Parameters** — what `@RequestParam` values are needed beyond `orgid`
- **Return type** — `Page<DTO>`, `List<DTO>`, single `DTO`, `byte[]` (for Excel), `void`

### Step 3 — Implement the Service Method

Add the new method to the existing service class. Services NO LONGER `extend GrantedPermissionService`;
they INJECT it (and `MapperUtil`) via constructor with Lombok `@RequiredArgsConstructor`. Both
`GrantedPermissionService` and `MapperUtil` are beans provided by the security starter.

```java
import com.pmis.common.security.service.GrantedPermissionService;
import com.pmis.common.security.util.SessionUtil;
import com.pmis.common.util.MapperUtil;
import com.pmis.common.util.StringUtil;
import com.pmis.common.exception.BadRequestException;

@Service
@RequiredArgsConstructor
@Slf4j
public class {ServiceName} {

    private final MapperUtil mapperUtil;
    private final GrantedPermissionService grantedPermissionService;
    // ... host repositories injected here too

    // READ - GET
    public List<{EntityName}DTO> {methodName}(String orgid, ...) {
        grantedPermissionService.orgGrantedForUserToRead(orgid);
        // query logic using repository
        return mapperUtil.convertToDtoList(results, {EntityName}DTO.class);
    }

    // WRITE - POST / PUT / PATCH / DELETE
    @Transactional
    public {ReturnType} {methodName}(String orgid, ...) {
        grantedPermissionService.orgGrantedForUserToWrite(orgid);
        // business logic
        log.info("...", SessionUtil.getCurrentUserId());
        return mapperUtil.convertToDto(saved, {EntityName}DTO.class);
    }
}
```

**Service rules:**
- Inject `GrantedPermissionService` via constructor — do NOT extend it
- Always call `grantedPermissionService.orgGrantedForUserToRead(orgid)` for GETs, `grantedPermissionService.orgGrantedForUserToWrite(orgid)` for mutations. These check methods auto-bypass `ROLE_SUPER_ADMIN` internally and throw `ForbiddenException` when denied
- Other granular checks available on the same bean: `plantGrantedForUserToRead/Write(plantid)`, `siteGrantedForUserToRead/Write(siteid)`, and `funcGrantedForUser(func, EPermission permission)` (returns `boolean`)
- For an explicit super-admin check use `SessionUtil.getRolesOfCurrentUser().contains(ERoleName.ROLE_SUPER_ADMIN.name())` — there is NO `checkSuperAdminRole()` in the library
- Use `mapperUtil.convertToDto / convertToDtoList / convertToEntity` — never manual field mapping
- Use `StringUtil.checkNullOrEmpty(keyword)` for optional string params
- Throw `BadRequestException` with Vietnamese message for not-found/validation errors
- Log with `log.info(...)` including `SessionUtil.getCurrentUserId()` for all write operations
- Use `@Transactional` on all write operations

> **Optional alternative — permission annotations:** instead of manual calls, the library's
> `PermissionAspect` honors method/class annotations: `@RequiresOrgRead`/`@RequiresOrgWrite`
> (default param `"orgid"`), `@RequiresPlantRead`/`@RequiresPlantWrite` (`"plantid"`),
> `@RequiresSiteRead`/`@RequiresSiteWrite` (`"siteid"`) from
> `com.pmis.common.security.annotation`. Manual calls remain the primary documented pattern.

> **Note on automatic enforcement:** the library's `FunctionAuthorizedInterceptor` ALSO enforces
> function-level + org-level permission for every non-whitelisted endpoint, based on
> `Q_FUNCTION_ENDPOINT` + the `orgid` header. This does NOT remove the need for the explicit
> permission call/annotation above, and the `Q_FUNCTION_ENDPOINT` SQL insert (Step 6) is STILL
> REQUIRED for each new endpoint.

### Step 4 — Add Repository Query (if needed)

If the service needs a query not already in the repository, add it:

```java
// Custom query pattern
@Query("SELECT e FROM {EntityName} e WHERE e.orgid = :orgid AND e.active = true ORDER BY e.{nameField} ASC")
List<{EntityName}> findActiveByOrgid(@Param("orgid") String orgid);
```

**Only add if** the existing repository methods don't cover the new logic. Check for reusable JPA derived queries first.

### Step 5 — Add Controller Endpoint

Add the new method to the existing controller class. Rules:

```java
@Operation(
        summary = "{Vietnamese summary}",
        description = "{Vietnamese description}."
)
@ApiResponses(value = {
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "200", description = "Thành công"),
        @io.swagger.v3.oas.annotations.responses.ApiResponse(responseCode = "403", description = "Không có quyền truy cập")
})
@{HttpMethod}("{/path-suffix}")   // omit suffix for root-level endpoints
public ResponseEntity<ApiResponse> {methodName}(
        @Parameter(description = "Mã đơn vị (từ header)", required = true) @RequestHeader("orgid") String orgid,
        @Parameter(description = "...") @RequestParam(required = false) String param1,
        ...) {
    return ResponseEntity.ok(ApiResponse.success(service.{methodName}(orgid, ...)));
}
```

**Controller rules — NON-NEGOTIABLE:**
- `@RequestParam` ALWAYS — never `@PathVariable`
- `@RequestHeader("orgid") String orgid` on EVERY endpoint
- Pass `orgid` to every service call
- Use `@Valid @RequestBody` for POST/PUT with DTO body
- For paginated results: return `ApiResponse.builder().data(...).count(...).countPage(...).build()`
- For single/list results: return `ApiResponse.success(result)`
- For write operations with message: `ApiResponse.success("Message thành công.", result)`
- For Excel export: return `ResponseEntity<byte[]>` with proper headers (Content-Disposition, Content-Type)

**Excel export pattern:**
```java
@GetMapping("/export-excel")
public ResponseEntity<byte[]> exportToExcel(
        @RequestHeader("orgid") String orgid,
        @RequestParam(required = false) String keyword) {
    byte[] bytes = service.exportToExcel(orgid, keyword);
    String filename = "Export_" + orgid + "_" + LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd")) + ".xlsx";
    return ResponseEntity.ok()
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + filename + "\"")
            .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
            .body(bytes);
}
```

### Step 6 — Generate SQL Script

Append to or create `scripts/insert_q_function_endpoint_{module}.sql`:

```sql
-- {Vietnamese description} 
INSERT INTO Q_FUNCTION_ENDPOINT (FUNCTIONID, ENDPOINT, METHOD, VAI_TRO)
VALUES ('{FUNCTIONID}', '{requestMapping}/{path-suffix}', '{METHOD}', '{VAI_TRO}');
```

**VAI_TRO mapping:**
| HTTP Method | VAI_TRO |
|-------------|---------|
| GET | READ |
| POST | CREATE |
| PUT / PATCH | EDIT |
| DELETE | DELETE |

**ENDPOINT** = `@RequestMapping` value + method-level mapping, **no leading slash**.

If FUNCTIONID was not provided, ask the user now before writing the script.

---

## Common API Patterns

### GET — Filtered list (no pagination)
```java
// Controller
@GetMapping("/active")
public ResponseEntity<ApiResponse> getActiveList(@RequestHeader("orgid") String orgid) {
    return ResponseEntity.ok(ApiResponse.success(service.getActiveList(orgid)));
}

// Service
public List<XxxDTO> getActiveList(String orgid) {
    grantedPermissionService.orgGrantedForUserToRead(orgid);
    return mapperUtil.convertToDtoList(repository.findActiveByOrgid(orgid), XxxDTO.class);
}
```

### GET — By additional filter param
```java
// Controller
@GetMapping("/by-type")
public ResponseEntity<ApiResponse> getByType(
        @RequestHeader("orgid") String orgid,
        @RequestParam String typeid) {
    return ResponseEntity.ok(ApiResponse.success(service.getByType(orgid, typeid)));
}
```

### POST — Batch create
```java
// Controller
@PostMapping("/batch")
public ResponseEntity<ApiResponse> createBatch(
        @RequestHeader("orgid") String orgid,
        @Valid @RequestBody List<XxxDTO> dtos) {
    return ResponseEntity.ok(ApiResponse.success("Tạo hàng loạt thành công.", service.createBatch(orgid, dtos)));
}
```

### PATCH — Custom state change
```java
// Controller
@PatchMapping("/approve")
public ResponseEntity<ApiResponse> approve(
        @RequestHeader("orgid") String orgid,
        @RequestParam String id) {
    return ResponseEntity.ok(ApiResponse.success("Phê duyệt thành công.", service.approve(orgid, id)));
}
```

---

## Checklist Before Reporting Done

- [ ] Read existing controller and service files
- [ ] Determined HTTP method, path suffix, and parameters from description
- [ ] Service method added with correct permission check via injected `grantedPermissionService` (`orgGrantedForUserToRead/Write`) — service does NOT extend `GrantedPermissionService`
- [ ] Repository query added if needed (or reused existing)
- [ ] Controller endpoint added (`@RequestParam` only, `orgid` header, Swagger annotations)
- [ ] SQL script created/updated in `scripts/`
- [ ] No `@PathVariable` used anywhere
- [ ] All Vietnamese messages in error throws and success responses