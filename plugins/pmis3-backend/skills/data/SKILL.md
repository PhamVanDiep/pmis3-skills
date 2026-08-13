---
name: data
description: 'Tầng dữ liệu backend PMIS3: chuyển đổi DTO bằng MapperUtil chứ không map tay, @Nationalized cho chuỗi trên SQL Server, chính sách mật khẩu, validation.'
---

# PMIS3 Data Transfer and Validation

## DTO Mapping with MapperUtil

`MapperUtil` comes from the library (`com.pmis.common.util.MapperUtil`) and is an **injected bean** (not static). Inject it via `@RequiredArgsConstructor`:
```java
private final MapperUtil mapperUtil;

// Entity to DTO
UserDto dto = mapperUtil.convertToDto(userEntity, UserDto.class);

// DTO to Entity
User entity = mapperUtil.convertToEntity(userDto, User.class);

// List conversion
List<UserDto> dtos = mapperUtil.convertToDtoList(userList, UserDto.class);
```

**Never use manual field mapping** - MapperUtil ensures field changes only require DTO/Entity updates, not code changes.

**Audit DTOs**: a DTO that exposes creator/modifier display names should extend `com.pmis.common.web.dto.AuditDTO` — the library's `DtoEnrichmentAdvice` auto-fills `userCrName` / `userMdfName` from `QUser`.

## Password Policy

When implementing user registration/password change, use `StringUtil.isValidPassword()`:
- Minimum 6 characters
- At least one digit
- At least one lowercase letter
- At least one uppercase letter
- At least one special character (@#$%^&+=)
- No whitespace

## @Nationalized for Unicode Support

Use `@Nationalized` annotation for text fields requiring Unicode support (Vietnamese characters):
```java
@Nationalized
@Column(name = "DESCRIPTION")
private String description;
```

This maps to `NVARCHAR` in SQL Server.

**Important**: In this database-first project, most string columns in SQL Server are `NVARCHAR`. Always add `@Nationalized` to string fields to avoid "The conversion from varchar to NCHAR is unsupported" errors. Check existing entities for consistency.

## Input Validation

- Use `@Valid` annotation on request body parameters in controllers
- Use Bean Validation annotations (`@NotNull`, `@NotBlank`, `@Size`, etc.) on DTO fields
- Always return DTOs, never expose entities directly in APIs

## Excel Export

When implementing Excel export functionality, always use the **`poi-ooxml`** library (Apache POI). The dependency is already included in `pom.xml`.

### Workbook Type

Always use **`SXSSFWorkbook`** (streaming variant) — never `XSSFWorkbook` or `HSSFWorkbook`:
- `SXSSFWorkbook` keeps memory footprint low for large datasets by flushing rows to disk
- Use a flush window of **100 rows**: `new SXSSFWorkbook(100)`

```java
import org.apache.poi.xssf.streaming.SXSSFWorkbook;
import org.apache.poi.xssf.streaming.SXSSFSheet;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Cell;
import org.apache.poi.ss.usermodel.CellStyle;

try (SXSSFWorkbook workbook = new SXSSFWorkbook(100)) {
    SXSSFSheet sheet = workbook.createSheet("Sheet1");
    // ... build rows ...
    ByteArrayOutputStream out = new ByteArrayOutputStream();
    workbook.write(out);
    workbook.dispose(); // delete temp files
    return ResponseEntity.ok()
        .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"" + fileName + "\"")
        .contentType(MediaType.parseMediaType("application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"))
        .body(out.toByteArray());
}
```

### Return Type

Controller export endpoints must return **`ResponseEntity<byte[]>`**:

```java
@GetMapping("/export-excel")
public ResponseEntity<byte[]> exportExcel(
        @RequestHeader("orgid") String orgid,
        @RequestParam(required = false) String keyword) {
    return yourService.exportToExcel(orgid, keyword);
}
```

Service method signature:
```java
public ResponseEntity<byte[]> exportToExcel(String orgid, String keyword)
```

### Endpoint Naming

Export endpoints follow the pattern `GET /{module}/export-excel`:
- `/mtc/export-excel`
- `/company/export-excel`

### File Naming Convention

Format: `DanhSach{TenModule}_{orgid}_{yyyyMMdd}.xlsx`

```java
String fileName = "DanhSach" + tenModule + "_" + orgid + "_"
    + LocalDate.now().format(DateTimeFormatter.ofPattern("yyyyMMdd")) + ".xlsx";
```

Examples:
- `DanhSachMayThiCong_{orgid}_{yyyyMMdd}.xlsx`
- `DanhSachCongTy_{orgid}_{yyyyMMdd}.xlsx`

### Repository Query Pattern

Add a dedicated `findAllForExport` method (no `Pageable`) that mirrors the existing paginated query:

```java
@Query("SELECT e FROM GEntity e WHERE e.orgid = :orgid AND (:keyword IS NULL OR e.name LIKE %:keyword%) ORDER BY e.name ASC")
List<GEntity> findAllForExport(@Param("orgid") String orgid, @Param("keyword") String keyword);
```
