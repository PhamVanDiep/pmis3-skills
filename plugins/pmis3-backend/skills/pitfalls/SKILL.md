---
name: pitfalls
description: 'Các lỗi hay mắc khi làm backend PMIS3 và cách tránh (DDL, audit, soft delete, unique index trên SQL Server, kiểm ràng buộc, DB dùng chung, debug lỗi 500, cột danh sách mã dấu phẩy, thứ tự triển khai cột/endpoint mới, danh mục dùng chung ORGID rỗng, search-core). Đọc khi debug hoặc review code backend.'
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

14. **Unique index trên cột cho phép trống (SQL Server)**: unique index KHÔNG có bộ lọc coi `NULL` là một giá trị —
    cả bảng chỉ được ĐÚNG MỘT dòng `NULL` (và một dòng `''`). Cột "được để trống" + unique thường = lỗi 500 từ
    bản ghi trống thứ hai. Cách xử lý: (a) nghiệp vụ bắt buộc nhập → chặn trống ở service (400); (b) cho trống →
    chuẩn hóa trống thành `NULL` (không bao giờ lưu `''`) VÀ index phải có bộ lọc `WHERE COL IS NOT NULL`.
    Xóa mềm không giải phóng giá trị: dòng `ISDEL = 1` vẫn giữ chỗ trong index.

15. **Kiểm ràng buộc ở service phải khớp phạm vi ràng buộc CSDL**: kiểm trùng chỉ trong "thiết bị còn sống của
    đơn vị" trong khi unique index áp TOÀN BẢNG (cả dòng đã xóa mềm, cả đơn vị khác) → giá trị lọt qua kiểm
    của service rồi CSDL ném `DataIntegrityViolationException` → 500 "Đã xảy ra lỗi hệ thống". Đọc định nghĩa
    index/constraint thật (`sys.indexes`, `docs/**/schema-dump.md`) trước khi viết kiểm; dồn kiểm vào MỘT
    component dùng chung cho thêm mới / cập nhật / đổi mã / import (vd `AAssetCodeGuard`).

16. **Chuẩn hóa chuỗi người dùng nhập trước khi kiểm và ghi**: trim, trống → `null`. Giao diện có thể gửi `''`,
    API khác gửi thiếu field (`null`) — hai đường cho hai giá trị khác nhau trong CSDL.

17. **DB dev là DB DÙNG CHUNG** (dù backend chạy trên máy): KHÔNG chạy DDL (tạo/xóa index, ALTER) hay UPDATE hàng
    loạt khi người dùng chưa đồng ý — viết script idempotent vào `scripts/` (kiểu `IF NOT EXISTS … sys.indexes`)
    và để người dùng chạy. Index có bộ lọc yêu cầu `QUOTED_IDENTIFIER`/`ANSI_NULLS` ON cho mọi lệnh ghi bảng —
    kiểm stored procedure/trigger cũ (`sys.sql_modules.uses_quoted_identifier`) trước khi đề xuất.

18. **Debug 500 "Đã xảy ra lỗi hệ thống"**: body không có nguyên nhân. Lấy stack trace từ console của service
    (chạy debug trong IntelliJ thì log CHỈ ở đó) hoặc viết test tái hiện — đừng đoán. Thử API bằng tay thì dùng
    ĐÚNG tên tham số như frontend gửi (sai tên `@RequestParam(required = false)` → giá trị null → lỗi giả).
    Sửa xong phải khởi động lại service trước khi kiểm lại.

19. **Cột chứa danh sách mã cách dấu phẩy** (`S_ATTRIBUTE_GROUP.DEFAULTTOALL`, `USINGBY`, …; giá trị như
    `A`, `A,B`, `B, A`): so khớp **đúng từng mã** — bọc dấu phẩy hai đầu, bỏ khoảng trắng:
    `',' + REPLACE(ISNULL(COL,''),' ','') + ',' LIKE '%,A,%'` (mã truyền bằng tham số, thoát `_ % [`).
    `LIKE '%A%'` khớp cả `AB`, `MA`, `CONGVIEC`… → lọt dữ liệu của đối tượng khác. Dùng hàm dùng chung
    `CodeListMatch` (bản SQL + bản Java cùng ngữ nghĩa — đã có trong `backend-thietbi` và `search-core`),
    unit test đủ: `A`, `A,B`, `B, A`, `AB`, `MA`, `A,A`, rỗng, null. `USINGBY` = nhóm dùng cho đối tượng nào
    (hiển thị/lọc/index); `DEFAULTTOALL` = nhóm tự gắn khi tạo mới.

20. **Thêm cột vào entity / thêm endpoint — thứ tự triển khai**: entity map cột chưa có trên DB → MỌI truy vấn
    của entity đó ném `Invalid column name` (500 ở cả API cũ). Endpoint mới chưa đăng ký `Q_FUNCTION_ENDPOINT`
    → bị chặn quyền. Mỗi thay đổi kèm 2 script idempotent trong `scripts/` (DDL; `INSERT Q_FUNCTION_ENDPOINT`)
    và ghi rõ trong báo cáo/PR: **chạy script → khởi động lại service → kiểm**. Sau khởi động lại mà endpoint
    mới vẫn `404 "Không tìm thấy endpoint"` → service chưa chạy bản mới.

21. **Danh mục dùng chung có `ORGID` rỗng** (vd `S_COMPANY` — nhà chế tạo / nhà cung cấp, cả bảng `ORGID = NULL`
    trên dev): lọc `ORGID = :orgid` trả danh sách rỗng mà không báo lỗi. Danh mục dùng chung lọc
    `(ORGID IS NULL OR ORGID = :orgid)`. Kiểm phân bố dữ liệu thật (`SELECT ORGID, COUNT(*) … GROUP BY ORGID`)
    trước khi viết điều kiện đơn vị cho bảng danh mục.

22. **Search-core (Elasticsearch) — thêm trường tìm kiếm**: (a) builder document + mapping (`IndexMappingService`,
    golden mapping test) ở `search-core`; (b) `thietbi` đọc kết quả qua `AssetSearchRow` của
    `pmis3-search-contract` (repo `backend-common`) — trường lạ bị bỏ qua: nâng contract, hoặc lớp con
    (`AssetSearchRowNames`) cho tới khi nâng; đồng bộ `docs/search-core/*.mapping.json` + `mapping-rules.md`
    của thietbi. Chỉ THÊM trường → không cần index mới: rollout **indexer trước, api sau** (indexer tự thêm
    mapping khi khởi động) rồi reindex `IN_PLACE`; đổi kiểu/analyzer → `NEW_INDEX`. Xóa index bằng tay
    (Kibana) → khởi động lại indexer NGAY để mapping sync tạo lại index + alias (job tự dựng lại không tự tạo
    index). Chi tiết vận hành: `pmis3-nguon-search-core/docs/RUNBOOK.md`.

