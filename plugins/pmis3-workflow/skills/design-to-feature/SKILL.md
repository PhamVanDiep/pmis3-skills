---
name: design-to-feature
description: 'Xây dựng chức năng CRUD (Frontend Angular 20 + Backend Spring Boot) từ bản thiết kế Claude Design (link claude.ai/design/...) kèm repo backend, entity liên quan và mô tả nghiệp vụ. Dùng khi user đưa link/file thiết kế Claude Design và muốn dựng feature đầy đủ.'
---

# Skill: Build Feature from Claude Design

## Khi nào áp dụng
Khi user yêu cầu xây dựng một chức năng từ **bản thiết kế Claude Design** (link `claude.ai/design/...`)
kèm theo: đường dẫn repo backend, các entity liên quan, và mô tả nghiệp vụ.

## Input cần có (hỏi nếu thiếu)
| Thông tin | Ví dụ |
|-----------|-------|
| **File màn hình (Claude Design)** | `screens/vat-tu.jsx` (⭐ trỏ thẳng **tên file `.jsx`** của màn cần làm) |
| **Link/project Claude Design** | `https://claude.ai/design/p/<uuid>` — hoặc dùng project mặc định của dự án |
| **Thư mục đặt chức năng (FE)** | `src/app/pages/admin/he-thong/<feature>` |
| **Repo backend** | `D:\SourceCode\PMIS3\PMIS3-NGUON\pmis3-nguon-backend-quantri` |
| **Entity liên quan** | `entity/quantri/vattu/GVattu.java`, `GVattuNhom.java`, ... |
| **Mô tả nghiệp vụ** | mapping cột, mặc định, danh mục liên kết, quy tắc đặc thù |

> Kết nối MCP + `project_id` + cấu trúc project xem **`.claude/design-mcp-setup.md`**.
> Project mặc định của dự án: `70779492-fa85-47ec-9e3b-91803b102751` (PMIS 3 nguồn).

## Bước 1 — Đọc đúng file màn hình (KHÔNG đọc cả `index.html`)
Trong project thiết kế, **mỗi màn hình là 1 file `.jsx`** trong `screens/` (vd `screens/vat-tu.jsx`,
`screens/thiet-bi.jsx`, `screens/co-cau.jsx`...). Trỏ thẳng file này thay vì đọc `index.html`/`standalone.html`
(rất lớn, cả app → tốn context, phải dispatch subagent trích lọc).

1. Nếu chưa biết tên file: `mcp__design__list_files path="screens"` để lấy đúng tên (kebab-case tiếng Việt không dấu).
2. `mcp__design__read_file path="screens/<man-hinh>.jsx"` — file nhỏ, chỉ chứa đúng màn hình cần làm.
   Đọc trực tiếp là đủ, **KHÔNG cần subagent** trong đa số trường hợp.
3. Chỉ khi màn hình phụ thuộc thành phần dùng chung (icon `I.*`, layout, token) → đọc thêm `js/core.jsx`;
   cần map route↔component → xem `js/app.jsx` (khối `active.page === "..."`).
4. Từ file `.jsx`, trích: layout, toolbar, cột bảng, bộ lọc, form chi tiết, dialog, trạng thái/tag,
   hành vi (hover, double-click, click số → dialog...). Giữ **nguyên văn nhãn tiếng Việt + danh sách option**.

## Bước 2 — Đọc entity backend & xác định mapping
- Đọc các entity tại đường dẫn được cung cấp. Ghi chú:
  - **Khóa chính**: `@Id` đơn hay `@EmbeddedId` (composite, vd `GVattuId{maVattu, orgid}`).
  - **Cột audit** có/không (`AuditableEntity`) → DTO có/không extend `AuditDTO`.
  - **Khoảng trống mapping**: trường thiết kế cần nhưng entity không có cột → map vào cột sẵn có
    (tài liệu hóa trong javadoc/comment), KHÔNG tự thêm cột/migration nếu chưa được duyệt.
  - **Entity thiếu `@Id`** (vd bảng ERP view) → KHÔNG tạo `@Entity`/repository, truy vấn bằng
    **native SQL** qua `EntityManager`.

## Bước 3 — Kiểm tra API backend đã có chưa
- Tìm controller/service/repository/DTO tương ứng. Nếu **chưa có** → cần làm cả backend.
- Mirror một module đã hoàn chỉnh cùng repo (vd `GVattuNhom`: controller `/vattu-nhom`,
  service dùng `grantedPermissionService.orgGrantedForUserTo{Read,Write}(orgid)`,
  `ApiResponse` builder, header `orgid`).

## Bước 4 — Chốt quyết định với user (AskUserQuestion)
Hỏi gọn các điểm làm thay đổi phạm vi:
1. **Phạm vi**: chỉ Frontend (theo contract giả định) hay **Frontend + Backend**.
2. **Layout chi tiết**: full-page (`PagePanelComponent`) theo prototype hay dialog.
3. **Hình ảnh / file**: nối file API thật hay preview tạm.

## Bước 5 — Implement
**Backend** (nếu có): `dto/.../<Feature>DTO` → `repository` (query lọc, batch) →
`service` (mapping thủ công cho composite key, native SQL cho tồn/aggregate) →
`controller` (`/<feature>`, header `orgid`). Endpoint chuẩn: list (lọc+phân trang),
detail, create, put, delete, bulk (`/bulk-status`, `/bulk`), export/import Excel.

**Frontend**: `models/quantri/<feature>.model.ts` → `services/quantri/<feature>.service.ts` →
trang list (`BaseComponent`, signals, lazy table, org filter `effect`) →
component chi tiết (full-page) → đăng ký route. **Tái dùng** các component dùng chung
(xem `.claude/rules/shared-components.md`).

### Bước 5b — Phân quyền API: script `Q_FUNCTION_ENDPOINT`
Nếu chức năng có **mã chức năng (functionid)** và **KHÔNG chỉ dành cho superadmin** (role thường
cũng được cấp quyền), thì **mọi endpoint API mới phải được đăng ký vào bảng `Q_FUNCTION_ENDPOINT`**
để bộ lọc phân quyền của common-security nhận diện endpoint thuộc chức năng nào.

Theo convention các script sẵn có trong repo backend `scripts/insert_q_function_endpoint_*.sql`
(vd `ca_truc`, `company`):
- Đặt file: `scripts/insert_q_function_endpoint_<feature>.sql`.
- Cột: **`FUNCTIONID, ENDPOINT, METHOD, VAI_TRO`** — mỗi cặp `(endpoint, method)` một dòng `INSERT ... VALUES`.
- `ENDPOINT`: đường dẫn tương đối theo **controller base, KHÔNG có dấu `/` đầu** (vd `vattu`, `vattu/detail`, `vattu/bulk-status`).
- `VAI_TRO` theo ngữ nghĩa hành động: `GET`/truy vấn → `READ`, `POST` tạo → `CREATE`, `PUT`/`PATCH` → `EDIT`, `DELETE` → `DELETE`.
- Đăng ký **đủ mọi endpoint** kể cả phụ (ton-kho, kho, export/import-excel, bulk...).
- `FUNCTIONID` là mã chức năng dạng `50.50.07`; nếu chưa biết, để placeholder `<FUNCTIONID>` + ghi chú thay sau.
- Nếu chức năng **chỉ superadmin** → KHÔNG cần script (superadmin bỏ qua kiểm tra endpoint).

## Bước 6 — Verify
- Backend: `./mvnw.cmd compile -DskipTests` → `BUILD SUCCESS`.
- Frontend: `npx ng build --configuration development` → `bundle generation complete`, không lỗi/cảnh báo NG.

## Bẫy thường gặp (đã trải nghiệm)
- **SQL Server giới hạn 2100 tham số** → chia lô mệnh đề `IN (...)` ≤ 1000 mã.
- **orgid của F_FILE** lấy theo orgid header lúc upload — query ảnh theo `objtypeid + objid + attachType` (+ orgid).
- **`p-select`/`p-multiselect` với dữ liệu lớn** → dùng `MaterialPickerDialogComponent` (lazy).
- **Thao tác hàng loạt** → viết API bulk, KHÔNG `forkJoin` lặp từng bản ghi.
- **Menu/route**: route mới có `permissionGuard` cần đăng ký function/permission ở admin để hiện menu & qua guard.

## Checklist
- [ ] Đã đọc đúng file `screens/<man-hinh>.jsx` (không đọc cả `index.html`) và trích nhãn + option nguyên văn
- [ ] Đã đọc entity, xác định PK/audit/mapping gap
- [ ] Đã kiểm tra API backend tồn tại hay chưa, chốt phạm vi với user
- [ ] Backend + Frontend build sạch
- [ ] Tái dùng component dùng chung thay vì viết lại
- [ ] Route đăng ký; nhắc user đăng ký permission/menu
- [ ] Nếu có functionid & không chỉ superadmin → đã gen script `Q_FUNCTION_ENDPOINT` cho mọi endpoint mới
