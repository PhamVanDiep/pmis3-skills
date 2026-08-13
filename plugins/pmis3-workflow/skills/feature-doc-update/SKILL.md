---
name: feature-doc-update
description: 'Dùng khi một chức năng đã có tài liệu BA ở `docs/feature/<slug>.md` và vừa được sửa/bổ sung code, cần cập nhật lại tài liệu cho khớp — đồng bộ API, bảng dữ liệu, luồng, sơ đồ và ghi lịch sử thay đổi. Tham số là thư mục chức năng (và/hoặc đường dẫn file tài liệu). Nếu chức năng CHƯA có tài liệu, dùng skill `feature-doc` để tạo mới.'
---

# Skill: Cập nhật tài liệu chức năng (`docs/feature`)

Đồng bộ lại tài liệu BA đã có với code hiện tại của chức năng, **giữ nguyên cấu trúc và nội dung thủ công**,
chỉ sửa những mục thực sự thay đổi, và ghi một dòng vào **lịch sử cập nhật**.

## Khi nào áp dụng
- Tài liệu `docs/feature/<slug>.md` **đã tồn tại** và chức năng vừa được thay đổi (thêm field/API, đổi luồng, đổi quyền…).
- Nếu **chưa có** tài liệu → dùng `feature-doc` (tạo mới), KHÔNG dùng skill này.

## Input (hỏi nếu thiếu)
| Thông tin | Ví dụ |
|-----------|-------|
| **Thư mục chức năng (FE)** | `src/app/pages/sxd/ke-hoach` |
| File tài liệu (nếu không suy ra được) | `docs/feature/ke-hoach.md` |
| Tóm tắt thay đổi (nếu user biết) | "Thêm nút xuất Excel + field ghi chú" |

**Tìm file tài liệu** (tên file đặt theo **tên chức năng tiếng Việt** bỏ dấu, không theo tên thư mục code):
1. Đọc component để lấy tên hiển thị (`<h1>`/breadcrumb) → suy ra slug tiếng Việt bỏ dấu (vd "Quản lý Nhóm vật tư" → `quan-ly-nhom-vat-tu`) → kiểm tra `docs/feature/<slug>.md`.
2. Không thấy → **quét toàn bộ `docs/feature/*.md`** và khớp theo header `**Thư mục:** <đường dẫn feature>` để tìm đúng file của chức năng.
3. Vẫn không thấy đúng 1 file → liệt kê các file trong `docs/feature/` và hỏi user chọn (hoặc nếu chưa có tài liệu → chuyển sang skill `feature-doc`).

## Quy trình

**B1 — Đọc tài liệu hiện tại.** Nắm cấu trúc mục (1..10), các bảng API/DB/Input/Output, sơ đồ Mermaid,
và những đoạn ghi chú thủ công (mục 8, 10) để **KHÔNG ghi đè mất**.

**B2 — Đọc lại code chức năng** theo đúng B1–B5 của skill `feature-doc`: component/html/route → service FE → **backend tương ứng** → model → luồng.
- **Bắt buộc đọc lại backend**: từ `AC_*` của service suy ra repo `../pmis3-nguon-backend-<x>`, đọc lại controller/service (luật nghiệp vụ, message lỗi) và entity ở `pmis3-nguon-info-entity` (bảng/cột). Logic nghiệp vụ có thể đã đổi ở BE dù FE không đổi.
- Xem thay đổi gần đây cả 2 phía:
  - FE: `git log --oneline -15 -- <thư mục>` và `git diff <commit-ghi-trong-doc>..HEAD -- <thư mục>` (commit lấy ở header tài liệu, nếu có).
  - BE: trong repo backend, `git log --oneline -15 -- <đường dẫn controller/service liên quan>`.

**B3 — Đối chiếu (diff) từng mục** giữa tài liệu và code, xác định:
- API: mới / đổi endpoint / đổi request-response / đổi nguồn tham số (header/param/body) / đã bỏ.
- Bảng DB & cột: theo entity BE (`@Table`/`@Column`) — cột mới, bỏ cột, đổi kiểu.
- Logic nghiệp vụ BE: luật validate/check trùng/ràng buộc mới hoặc đổi, **message lỗi** mới.
- Input/Output: field form, validate, cột hiển thị.
- Quyền, org filter.
- Luồng chính/ngoại lệ → có cần vẽ lại Activity/Sequence không.

**B4 — Cập nhật có chọn lọc:**
- Chỉ sửa mục **thực sự thay đổi**; giữ nguyên phần đúng và mọi ghi chú thủ công.
- Cập nhật lại header: `Cập nhật:` = ngày commit mới nhất của thư mục
  (`git log -1 --format=%cd --date=format:%d/%m/%Y -- <thư mục>`), `Commit:` = `git log -1 --format=%h -- <thư mục>`.
- Vẽ lại sơ đồ Mermaid **chỉ khi** luồng đổi; giữ Mermaid render được.
- Chỗ chưa xác minh được → đánh dấu `(suy luận)`/`(chưa xác định)`, không bịa.

**B5 — Ghi lịch sử thay đổi.** Thêm/nối vào mục **"Lịch sử cập nhật"** ở cuối tài liệu (tạo mục nếu chưa có):

```markdown
## Lịch sử cập nhật
| Ngày | Commit | Thay đổi |
|------|--------|----------|
| dd/MM/yyyy | `<hash>` | <mô tả ngắn những gì đã sync: thêm API xuất Excel, thêm field ghi chú...> |
```
(dòng mới nhất ở trên cùng.)

**B6 — Báo cáo:** liệt kê ngắn gọn các mục đã đổi và các mục giữ nguyên; đưa đường dẫn file.

## Nguyên tắc
- **Không viết lại toàn bộ tài liệu** khi chỉ đổi vài chỗ — cập nhật tối thiểu, bảo toàn công sức đã có.
- **Bảo toàn nội dung thủ công** ở mục "Logic nghiệp vụ đặc thù" và "Ghi chú/Vấn đề còn mở" — chỉ thêm, không xóa trừ khi đã sai.
- Nếu cấu trúc tài liệu cũ **thiếu mục** so với template của `feature-doc` (vd làm trước khi có template) → bổ sung mục thiếu theo đúng thứ tự template.
- Nếu tài liệu và code lệch quá nhiều (đổi bản chất chức năng) → báo user và đề xuất tạo lại bằng `feature-doc` thay vì vá.
- Luôn giữ Mermaid hợp lệ; sau khi sửa, đọc lại file để chắc chắn không sót placeholder.
