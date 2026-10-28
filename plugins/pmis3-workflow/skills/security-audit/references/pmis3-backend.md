# Backend PMIS3 — cơ chế bảo mật thật và điểm hay hở

Đọc mã của starter trước khi kết luận: lớp chặn có thể đã có (báo nhầm) hoặc mỏng hơn tưởng (bỏ sót). Đường dẫn
dưới tính từ `pmis3-<hệ>-security-starter/src/main/java/com/pmis/common/security/`.

## Các lớp chặn của một request

1. **Spring Security** (`autoconfigure/PmisWebSecurityAutoConfiguration`): `VSecurityConstants.WHITE_LIST` là
   `permitAll`, còn lại `authenticated()`. `STATELESS`, **CSRF tắt**, CORS theo cấu hình mặc định. Service tự khai
   `SecurityFilterChain` riêng thì starter lùi lại (`@ConditionalOnMissingBean`) — rà chuỗi đó thay thế.
2. **JWT** (`web/JwtAuthenticationFilter`): token lấy từ header `Authorization: Bearer`, **không có thì lấy từ
   cookie access token**. Vì CSRF tắt mà cookie vẫn xác thực được, chống CSRF phụ thuộc thuộc tính `SameSite` của
   cookie (`CookieUtil`) và CORS — xem mục CSRF trong `pmis3-frontend.md`.
3. **Kiểm quyền chức năng + đơn vị** (`web/FunctionAuthorizedInterceptor`) chạy cho mọi request:
   - Bỏ qua khi URI khớp `pmis.security.white-list` theo **`equalsIgnoreCase` HOẶC `endpoint.contains(mục)`** —
     so khớp chuỗi con. Một mục ngắn như `error` làm **mọi** endpoint có chữ `error` trong path bỏ qua kiểm chức
     năng và đơn vị (vẫn phải đăng nhập).
   - `ROLE_SUPER_ADMIN` bỏ qua mọi kiểm.
   - Tra cặp (endpoint, method) trong `Q_FUNCTION_ENDPOINT`; thiếu cặp → `AppException` (chặn, không mở). Kiểm
     người dùng có chức năng với vai trò `READ`/`UPDATE` của cặp đó.
   - Kiểm đơn vị **chỉ theo header `orgid`** người dùng tự gửi.
4. **Service**: `GrantedPermissionService.orgGrantedForUserToRead/Write(orgid)`, `funcGrantedForUser(...)`,
   annotation `@RequiresOrgRead` / `@RequiresOrgWrite`. Starter PMIS3-LUOI hiện chỉ có kiểm theo **đơn vị**; API
   nhận `plantid` / `assetid` / id thiết bị phải tự kiểm đối tượng thuộc đơn vị được gán.

## Điểm hay hở — rà theo thứ tự

### (iii) IDOR theo đơn vị — loại phát hiện thật phổ biến nhất

Interceptor chỉ chứng minh người dùng được gán đơn vị **trong header**. Bản ghi lấy theo `id` từ tham số có thể
thuộc đơn vị khác.

- Dấu hiệu: service `findById(id)` / `deleteById(id)` / `save(entity từ request)` mà không so `entity.getOrgid()`
  với `orgid` đã kiểm, hoặc truy vấn không có `AND e.orgid IN (...)`.
- Đặc biệt: cập nhật / xóa / xem chi tiết / tải tệp đính kèm theo id, API bulk nhận danh sách id.
- Danh mục dùng chung `ORGID IS NULL` (vd `S_COMPANY`): ai có quyền ghi chức năng là sửa được dữ liệu của mọi đơn
  vị — xác minh thao tác ghi có giới hạn cho quản trị không.
- Đề xuất: lấy bản ghi rồi `grantedPermissionService.orgGrantedForUserToWrite(entity.getOrgid())`, hoặc truy vấn
  kèm điều kiện đơn vị.

### (iii) Khai báo quyền sai

- Endpoint mới có path chứa một mục whitelist (`error`, `swagger-ui`, `v3/api-docs`, `actuator/health`…) → bỏ qua
  kiểm quyền. Mục whitelist mới thêm: hỏi lý do, kiểm nó không là chuỗi con của endpoint nghiệp vụ.
- Cặp trong script SQL `Q_FUNCTION_ENDPOINT` khai vai trò `READ` cho endpoint ghi dữ liệu (kể cả `GET` có tác dụng
  ghi, xuất dữ liệu nhạy cảm) → người chỉ có quyền xem thực hiện được thao tác ghi.
- Endpoint quản trị (phân quyền, người dùng, cấu hình) gắn chung chức năng với endpoint nghiệp vụ thường.

### (iii) Điểm vào không qua HTTP

`@KafkaListener`, `@Scheduled`, consumer thông báo không có người dùng đăng nhập: kiểm dữ liệu từ message được
kiểm hợp lệ, không tin `orgid`/`userid` trong message mà không đối chiếu.

### (iv) SQL

- `nativeQuery = true`, `EntityManager.createNativeQuery`, `JdbcTemplate`, StringBuilder ghép `WHERE`/`ORDER BY`.
  JPQL với `:param` là an toàn; nối chuỗi vào JPQL vẫn là tiêm nhiễm.
- Sắp xếp theo tên cột client gửi (`sortField`, `Sort.by(param)` vào native query) → cần danh sách trắng.
- `LIKE` ghép `%` + giá trị trong chuỗi SQL thay vì trong tham số.

### (ii) Lộ thông tin

- `application*.yml` phải dùng `${ENV}`; `.env` nằm trong `.gitignore` — kiểm bằng `git ls-files`, không đọc nội dung.
- Lỗi 500 chuẩn trả câu chung + mã tra cứu, chi tiết chỉ vào log (xem `permissionCheckFailure` trong interceptor).
  Exception handler mới trả `e.getMessage()`, câu SQL, tên bảng ra client là phát hiện.
- Log ghi họ tên, email, số điện thoại, nội dung token/OTP; log nối chuỗi.

### (i) Cấu hình, tệp, gọi ra ngoài

- `SWAGGER_ENABLED` mặc định `true`: môi trường thật phải tắt. Actuator chỉ mở `health`.
- Nhận tệp: giới hạn kích thước, kiểm phần mở rộng + nội dung, tên tệp từ client không ghép vào đường dẫn lưu (path
  traversal). Import Excel (Apache POI): giới hạn số dòng, tệp nén quá lớn; XML phải tắt external entity (XXE).
- Xuất Excel/PDF không giới hạn số dòng → rút trích hàng loạt, cạn tài nguyên (BE-06).
- Gọi Gotenberg / EVNID / URL tệp: địa chỉ đích không lấy từ đầu vào người dùng (SSRF).
- Đăng nhập, OTP, quên mật khẩu (quantri): giới hạn số lần thử, OTP hết hạn và đếm lần nhập sai.
