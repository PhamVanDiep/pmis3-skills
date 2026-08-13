---
name: design-to-feature-sxd
description: '(SXD) Xây dựng một chức năng từ bản thiết kế Claude Design (link claude.ai/design/...) kèm repo backend, entity liên quan và mô tả nghiệp vụ → sinh Frontend (Angular 20) + Backend (Spring Boot). Dùng khi user đưa link Claude Design và muốn dựng feature CRUD đầy đủ cho phân hệ SXD.'
---

# Skill: Build Feature from Claude Design (SXD)

## Khi nào áp dụng
Khi user yêu cầu xây dựng một chức năng cho phân hệ SXD từ: **link bản thiết kế Claude Design** + **file SPEC** (mô tả nghiệp vụ/data) + entity backend liên quan.

## Input cần có (hỏi nếu thiếu)
| Thông tin | Ví dụ |
|-----------|-------|
| **Link Claude Design** | `https://claude.ai/design/p/<uuid>` |
| **File SPEC** | `docs/sxd/FE_<TEN>_SPEC.md` — soạn theo `docs/sxd/_SPEC_TEMPLATE.md` |
| **Thư mục FE** | `src/app/pages/sxd/<feature>` (luôn dưới nhánh `sxd/`) |
| **Repo backend** | `pmis3-nguon-backend-sxd` (`/pmis3-nguon-sxd/v1`, port `8998`, base package `com.pmis3.nguon`) |
| **Entity liên quan** | `entity/sxd/<...>.java` (sxd-entity) hoặc `info/entity/*` (info-entity) |

> **Backend tuân thủ y hệt rule `pmis3-nguon-backend-quantri`** (cùng shared starter `com.pmis:pmis3-security-starter`):
> `@RequestParam` thay `@PathVariable`, `MapperUtil` cho mọi DTO, header `@RequestHeader("orgid")`,
> inject `GrantedPermissionService`, `@Nationalized`, `null` (không `0L`), `ddl-auto=none`, text tiếng Việt.
> Chi tiết: `pmis3-nguon-backend-sxd/.claude/skills/` + `CLAUDE.md`.

---

## ⛔ Bước 0 — PRE-FLIGHT (BẮT BUỘC, làm trước khi viết bất kỳ dòng code nào)

Đây là khâu quyết định chất lượng. **3 lần sai nhiều nhất** đều do bỏ qua bước này.

1. **Đọc SPEC theo template `docs/sxd/_SPEC_TEMPLATE.md`.** Nếu SPEC thiếu mục nào (đặc biệt: data-contract đã verify, nghiệp vụ-phạm-vi, dữ liệu test, tiêu chí nghiệm thu) → **hỏi user / điền cho đủ trước khi code**.
2. **ĐỌC BẢN THIẾT KẾ QUA DesignSync — KHÔNG được code chỉ từ SPEC.**
   - `DesignSync list_files` → `get_file` các file UI (vd `sanxuat/app.jsx`, `sanxuat/index.html`).
   - Nếu lỗi auth → bảo user chạy `/design-login` rồi thử lại.
   - Trích **nguyên văn**: icon (tên + path SVG), bảng màu (biến CSS), layout từng vùng, class chip/badge, bố cục dialog, hành vi (click/hover/sort/filter). Icon/màu/CSS **lấy từ design**, không bịa.
3. **ĐỐI CHIẾU DATA-CONTRACT BẰNG QUÉT CODE BACKEND — KHÔNG truy cập DB trực tiếp** (vào DB rất rủi ro). Xác nhận **cấu trúc mapping** qua code:
   - **Entity** (`@Column`): cột tồn tại đúng tên, kiểu; PK; có audit không.
   - **Repository** (`@Query`/native): câu lệnh lọc, `ROWGROUP` của danh mục đang dùng, điều kiện join.
   - **Service hiện có** dùng cùng danh mục/bảng để biết quy ước thật (vd loại hình lấy `ROWGROUP` nào).
   - Đối chiếu với mapping mà SPEC khẳng định → **bắt mismatch SPEC ↔ code** (vd SPEC ghi field X nhưng entity không có cột).
   - **Dữ liệu thực tế (giá trị rác/null, đơn vị trống...)** KHÔNG kiểm bằng DB — kiểm bằng **response API trên app đang chạy** (DevTools Network) ở Bước 6, hoặc nhờ user xác nhận.
4. **Chốt nghiệp vụ mơ hồ với user** — xem Bước 4.

> Nguyên tắc vàng: **dựng "khung dữ liệu" (API contract) đúng trước, tỉa UI sau.** Xác nhận `tree`/`summary` trả đúng field/loại hình/màu bằng **DevTools** (response API) rồi mới chỉnh CSS — tránh sửa UI nhiều vòng khi dữ liệu chưa đúng. (Đây cũng là cách kiểm dữ liệu thay cho truy cập DB.)

---

## Bước 1 — Trích bản thiết kế (đã đọc ở Bước 0)
File design thường lớn (mock cả app). **Dispatch subagent** đọc và trích đúng màn hình cần làm: layout, toolbar, cột bảng, bộ lọc, form/dialog, trạng thái/badge, icon (tên + màu), hành vi. Trả nguyên văn nhãn tiếng Việt + option + mã màu (biến CSS) + tên icon.

## Bước 2 — Đọc entity backend & mapping
- PK đơn hay `@EmbeddedId`; có cột audit không (→ DTO extend `AuditDTO` hay không).
- Khoảng trống mapping: field thiết kế thiếu cột → map vào cột sẵn có + ghi chú; **KHÔNG tự thêm cột/migration**.
- Entity thiếu `@Id` → native SQL qua `EntityManager`.
- Entity hay dùng lại: `SMainasset`/`SLoainhienlieu` (sxd-entity); `SPlant`/`SOrganization`/`SLstCommon` (info-entity).

## Bước 3 — Kiểm tra API backend đã có chưa
- Tìm controller/service/repository/DTO trong `pmis3-nguon-backend-sxd`. Chưa có → làm cả backend.
- Mirror module hoàn chỉnh cùng repo (hoặc pattern từ `quantri`): `grantedPermissionService.orgGrantedForUserTo{Read,Write}(orgid)`, `ApiResponse` builder, header `orgid`. Đặt code dưới `com.pmis3.nguon.*.sxd`.

## Bước 4 — Chốt quyết định với user (AskUserQuestion)
Hỏi gọn các điểm **thay đổi phạm vi hoặc dễ sai** (rút từ kinh nghiệm):
1. **Phạm vi CRUD**: chỉ Sửa hay đầy đủ Tạo/Sửa/Xóa.
2. **Phạm vi lọc dữ liệu theo `orgid` header** (rất hay sai — xem Pattern phía dưới): cây con đơn vị header? hay tất cả đơn vị được cấp quyền? hay chỉ đơn vị header?
3. **Nguồn loại hình/danh mục theo từng cấp** (nếu nhiều cấp có loại hình khác nhau) + **màu** lấy ở đâu (vd `S_LST_COMMON.PARAM1`).
4. **functionid** + có dành cho role thường không (để gen `Q_FUNCTION_ENDPOINT`).
5. **Layout**: dialog hay full-page (`PagePanelComponent`).

## Bước 5 — Implement

**Backend**: `dto/.../<Feature>DTO` → `repository` (query lọc, batch) → `service` → `controller` (`/<feature>`, header `orgid`).
Vị trí: `com.pmis3.nguon.{dto,repository,service,controller}.sxd`.

**Frontend** (riêng SXD dưới `sxd/`, dùng chung giữ nguyên vị trí chung):
- Model `models/sxd/<feature>.model.ts`, Service `services/sxd/<feature>.service.ts`, Page `pages/sxd/<feature>/`, Route dưới nhánh `sxd`. Hằng số `AC_SXD` (thêm nếu chưa có).
- **Tái dùng component dùng chung** (`shared/components/...`, `BaseComponent`, stores, interceptor, `app-lucide-icon`...) — KHÔNG copy vào `sxd/`.

### Pattern hay dùng (đã đúc kết)
- **Phạm vi đơn vị theo `orgid` header** (`resolveTargetOrgs`): từ orgid → đọc `ORGLEVEL`. `='P'` → chỉ đơn vị header. `!='P'` → đơn vị **được cấp quyền** (`sOrgGrantQueryRepository.findAllOrgGranted(userId)`) **GIAO CÂY CON** của đơn vị header (theo `ORGID_PARENT`); superadmin = nguyên cây con. ⚠️ KHÔNG trả "tất cả đơn vị được cấp quyền" phẳng → sẽ lòi đơn vị **ngang hàng** (chọn Sơn La lại ra Thái Bình).
- **Loại hình theo từng cấp**: mỗi cấp map một `ROWGROUP` riêng của `S_LST_COMMON` (vd đơn vị nhóm 29, nhà máy nhóm 28, tổ máy/lò nhóm 32). Đừng để leaf "kế thừa" loại hình của cha nếu nghiệp vụ tách riêng.
- **Màu danh mục**: lưu ở `S_LST_COMMON.PARAM1` (hex). BE trả `mau`/`mauLoaiHinh`; FE ưu tiên màu này, **fallback** theo tên (`resolveLoaiHinhColor`).
- **Icon**: dùng **component dùng chung `app-lucide-icon`** (`shared/components/lucide-icon`); thêm icon mới = `registerLucideIcons({...})`, lấy path SVG đúng từ design.
- **SQL Server**: chia lô mệnh đề `IN (...)` ≤ 1000.

### Bước 5b — Phân quyền API: script `Q_FUNCTION_ENDPOINT`
Nếu có **functionid** & **không chỉ superadmin**: mọi endpoint mới đăng ký vào `Q_FUNCTION_ENDPOINT`.
- File `scripts/insert_q_function_endpoint_<feature>.sql`; cột `FUNCTIONID, ENDPOINT, METHOD, VAI_TRO`.
- `ENDPOINT` theo controller base, **không `/` đầu** (vd `co-cau-huy-dong-nguon/tree`).
- `VAI_TRO`: GET→READ, POST→CREATE, PUT/PATCH→EDIT, DELETE→DELETE. Đăng ký đủ mọi endpoint.

### Bước 5c — Menu (Q_FUNCTION) — để menu con hiện ra
Menu sidebar lấy từ bảng **`Q_FUNCTION`** (DB quántri) qua API `GET /pmis3-nguon-quantri/v1/function/granted`.
Thêm record menu: functionid, parent đúng, `URL` **khớp route** (vd `/sxd/<feature>`), `ISMENU=1`, `ENABLE=1`.
(nếu không superadmin) cấp quyền READ. **Đăng nhập lại** (grantedFunctions cache ở localStorage lúc login).
URL sai route → `permissionGuard` đá `/403`. Sidebar hỗ trợ menu N cấp.

## Bước 6 — Verify
- Backend: `./mvnw.cmd compile -DskipTests` → `BUILD SUCCESS`.
- Frontend: `npx ng build --configuration development` → `bundle generation complete`, không warning NG.
- **Đối chiếu Tiêu chí nghiệm thu (mục 9 SPEC)** + xem response API bằng DevTools cho đúng đơn vị test.

## Bẫy hạ tầng (luôn kiểm tra)
- **DB sxd = `QLKT_SXD_V3`** (KHÔNG phải PMIS_UPGRADE) — chỉ để biết, **KHÔNG truy cập DB trực tiếp**. **quántri port 8990** (không phải 9000), sxd 8998, FE 4200.
- `application.yml` sxd cần `app.file.upload/convert` + `app.seaweed.*` + Redis (port/password theo môi trường) — thiếu là không start.
- Dữ liệu test: nếu cây/bảng trống → kiểm **response API (DevTools)** xem BE trả rỗng thật không; nhờ **user** xác nhận/seed dữ liệu cho đơn vị demo. KHÔNG tự query DB.

## Checklist hoàn thành
- [ ] **Đã đọc design qua DesignSync** (icon/màu/CSS/layout trích nguyên văn)
- [ ] **Data-contract đã đối chiếu CODE backend** (entity `@Column` + repository `@Query`), bắt mismatch SPEC↔code; dữ liệu thực kiểm qua **response API** (KHÔNG truy cập DB)
- [ ] **Đã chốt nghiệp vụ-phạm-vi (orgid/quyền)** + nguồn loại hình/màu theo cấp
- [ ] Đọc entity: PK/audit/mapping gap
- [ ] Backend + Frontend build sạch
- [ ] Tái dùng component dùng chung (icon `app-lucide-icon`...) thay vì viết lại
- [ ] `Q_FUNCTION_ENDPOINT` (phân quyền) + `Q_FUNCTION` (menu) + nhắc re-login
- [ ] Đối chiếu Tiêu chí nghiệm thu + kiểm response API trên đơn vị test
