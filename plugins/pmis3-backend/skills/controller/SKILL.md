---
name: controller
description: 'Viết controller backend PMIS3: bắt buộc dùng @RequestParam thay @PathVariable, header orgid, cấu trúc endpoint, khai báo Swagger.'
---

> **Tham số theo repo** — thay các placeholder dưới đây bằng giá trị của **repo hiện tại**,
> đọc ở `CLAUDE.md` tại gốc repo (hoặc `application.yml` / `pom.xml`):
>
> | Placeholder | Ý nghĩa | Ví dụ |
> |---|---|---|
> | `{module}` | hậu tố module, cũng là tên thư mục con trong `entity/`, `dto/`, `repository/`, `service/` | `quantri`, `sxd`, `vattu`, `thietbi` |
> | `{Module}` | dạng PascalCase của `{module}` | `Quantri`, `Sxd` |
> | `{PORT}` | cổng service | `9000`, `8998` |
>
> KHÔNG hard-code giá trị của một module cụ thể — mỗi microservice một khác.

# PMIS3 Controller Patterns

## IMPORTANT RULES

### 1. Use @RequestParam instead of @PathVariable

```java
// WRONG - Don't use @PathVariable
@GetMapping("/{id}")
public ResponseEntity<?> getById(@PathVariable String id) { }

// CORRECT - Use @RequestParam
@GetMapping
public ResponseEntity<?> getById(@RequestParam String id) { }
```

### 2. Use MapperUtil for all DTO conversions

```java
// CORRECT - Field changes only require DTO/Entity updates
SomeDTO dto = mapperUtil.convertToDto(entity, SomeDTO.class);
SomeEntity entity = mapperUtil.convertToEntity(dto, SomeEntity.class);
List<SomeDTO> dtos = mapperUtil.convertToDtoList(entities, SomeDTO.class);

// WRONG - Manual field mapping requires code changes
SomeDTO dto = new SomeDTO();
dto.setField1(entity.getField1());
dto.setField2(entity.getField2());
```

### 3. Always include orgid header

```java
@GetMapping
public ResponseEntity<ApiResponse> getAll(
        @RequestHeader("orgid") String orgid,
        @RequestParam(required = false) String keyword) {
    return ResponseEntity.ok(ApiResponse.success(
        yourService.getAll(orgid, keyword)));
}
```

### 4. Don't create documentation files unless explicitly requested

- Only create `.md` files if user explicitly asks for documentation
- Focus on implementing working code first
- Use code comments and Swagger annotations for API documentation

### 5. Auto-gen Q_FUNCTION_ENDPOINT insert scripts

When creating new API endpoints (excluding super admin endpoints), **always generate SQL insert scripts** for `Q_FUNCTION_ENDPOINT` table:

```sql
-- Table structure:
-- Q_FUNCTION_ENDPOINT(FUNCTIONID, ENDPOINT, METHOD, VAI_TRO) - composite PK on all 4 columns

INSERT INTO Q_FUNCTION_ENDPOINT (FUNCTIONID, ENDPOINT, METHOD, VAI_TRO)
VALUES ('QLDA', 'du-an', 'GET', 'READ');
INSERT INTO Q_FUNCTION_ENDPOINT (FUNCTIONID, ENDPOINT, METHOD, VAI_TRO)
VALUES ('QLDA', 'du-an', 'POST', 'CREATE');
```

**Rules:**
- **FUNCTIONID**: Provided by user in prompt. If not provided → ask for it.
- **ENDPOINT**: `@RequestMapping` value + function-level mapping (if any). **Remove leading `/`** if present.
  - Example: `@RequestMapping("/du-an")` + `@GetMapping("/chi-tiet")` → `du-an/chi-tiet`
  - Example: `@RequestMapping("/du-an")` + `@GetMapping` → `du-an`
- **METHOD**: HTTP method — `GET`, `POST`, `PUT`, `PATCH`, `DELETE`
- **VAI_TRO**: Role mapping:
  - `GET` → `READ`
  - `POST` → `CREATE`
  - `PUT` / `PATCH` → `EDIT`
  - `DELETE` → `DELETE`
- **Save scripts** in `scripts/` folder at project root, named `insert_q_function_endpoint_<module>.sql`.
- **Update `VFunction.java`**: Add a constant for the new FUNCTIONID in `com.pmis3.nguon.constant.VFunction` (e.g., `public static final String QT_UD_QLCT = "50.01.05";`).
- **Auto-generate on CRUD creation**: When building a new CRUD module and the user provides a mã chức năng (FUNCTIONID), automatically generate the script and update VFunction without being asked.

### 6. Auto-gen FE Specification Document

When building a new CRUD module, **always generate a FE spec document** at `../pmis3-nguon-frontend/docs/FE_{MODULE}_SPEC.md` following the `/pmis3-frontend-spec` skill format. This ensures the frontend team has API documentation immediately.

## Controller Implementation Checklist

1. **Follow RESTful conventions** - Use proper HTTP methods (GET, POST, PUT, DELETE)
2. **Return DTOs, not entities** - Use `MapperUtil` for conversion
3. **Add Swagger annotations** - SpringDoc OpenAPI is configured
4. **Handle exceptions properly** - Return meaningful error messages
5. **Validate input** - Use `@Valid` and custom validators
6. **Include `orgid` header** - All endpoints must include `@RequestHeader("orgid") String orgid`
7. **Pass `orgid` to services** - Service methods should receive `orgid` for permission checking

## Base Configuration

- **Server Port**: {PORT} (configurable via `SERVER_PORT`)
- **Context Path**: `/pmis3-nguon-{module}/v1`
- **Max File Upload**: 50MB

## Endpoint Authorization Pattern

Function-level + organization-level authorization runs **automatically** via the library's `FunctionAuthorizedInterceptor` for every non-whitelisted endpoint — you do not write code for it, but each endpoint needs a row in `Q_FUNCTION_ENDPOINT`. Based on `QFunctionEndpoint`, each endpoint should:
1. Map to a function (`FUNCTIONID`)
2. Specify HTTP method (GET, POST, PUT, DELETE)
3. Include role-based access control (`VAI_TRO`)
4. Be added to `pmis.security.white-list` (in `application.yml`) if it must be public

> `ApiResponse` is `com.pmis.common.web.dto.response.ApiResponse`; `@CurrentUser` / `CustomUserDetails` come from the library (`com.pmis.common.security.*`). Plant/site-scoped endpoints can add `@RequiresPlant*` / `@RequiresSite*` on the service method.

## Expected Endpoint Structure

```
/pmis3-nguon-{module}/v1/
├── /auth           # Authentication (login, logout, refresh, TFA)
├── /users          # User management
├── /roles          # Role management
├── /functions      # Function/menu management
├── /organizations  # Organization CRUD
├── /plants         # Plant management
├── /departments    # Department operations
└── /permissions    # Permission assignment
```

## Swagger/OpenAPI Documentation

- **Swagger UI**: http://localhost:{PORT}/pmis3-nguon-{module}/v1/swagger-ui.html
- **OpenAPI JSON**: http://localhost:{PORT}/pmis3-nguon-{module}/v1/v3/api-docs
