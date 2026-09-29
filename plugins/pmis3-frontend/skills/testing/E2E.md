# E2E (Playwright)

Tham chiếu của skill [`testing`](SKILL.md). Mọi spec import `test`, `expect` từ `e2e/fixtures`.

## Cấu trúc

```
e2e/
├── fixtures/index.ts        # test.extend: api, shell + option quyền/đơn vị/đăng nhập
├── support/                 # MockApi, seedSession
├── pages/                   # page object DÙNG CHUNG: app-shell, data-table, form-dialog
│   └── <module>/<feature>.page.ts   # page object riêng của màn
├── data/<module>/<feature>.ts       # builder dữ liệu mẫu (kiểu DTO thật)
├── <module>/<feature>.spec.ts       # hành trình của màn — vd e2e/thietbi/thiet-bi.spec.ts
└── smoke/                           # backend thật, tag @smoke
```

Tag mỗi `describe` theo module (`@thietbi`, `@thinghiem`, `@suco`, `@scbd`, `@rcm`, `@cbm`) để chạy
riêng: `npx playwright test --grep @suco`.

## Fixture

| Option (`test.use({...})`) | Mặc định | Ý nghĩa |
|---|---|---|
| `screenPermissions` | `FULL_PERMISSIONS` | Kết quả `GET function/permissions` — dùng `READ_ONLY` hoặc object tự khai |
| `menu` | `[]` | Kết quả `GET function/granted` |
| `org` | `E2E_ORG` | Đơn vị đang chọn (`null` = chưa chọn) |
| `loggedIn` | `true` | Có phiên đăng nhập sẵn |
| `mockBackend` | `true` | `false` ở project smoke |

Fixture `api` (tự bật) chặn mọi request `pmis3-luoi-*/v1/**`; `shell` là `AppShell` (toast, xác nhận).

## MockApi

| Method | Dùng để |
|---|---|
| `api.ok(method, path, data, { count })` | Trả `apiOk(data)`; `path` là phần sau `/v1/` (chuỗi khớp tuyệt đối hoặc RegExp) |
| `api.fail(method, path, message)` | Lỗi nghiệp vụ HTTP 200 `type: ERROR` |
| `api.httpError(method, path, status, message)` | 403 thiếu quyền, 409 xung đột, 500 lỗi hệ thống |
| `api.on(method, path, call => body)` | Handler theo request — backend có trạng thái |
| `api.calls(...)`, `api.lastCall(...)` | Request đã gửi: `params`, `body`, `headers` |
| `api.waitForCall(...)` | Chờ FE gửi request (gọi TRƯỚC hành động gây ra request) |
| `api.unhandled` | Endpoint chưa khai mock — soi khi test đỏ khó hiểu |

Khai sau thắng khai trước: `beforeEach` khai dữ liệu nền, từng test ghi đè endpoint nó quan tâm.

## Page object

- Phần chung đã có: `AppShell` (`expectToast`, `confirm`, `cancelConfirm`), `DataTable` (`rows`, `row`,
  `cell(dòng, cột)`, `action(dòng, 'Sửa')`, phân trang), `FormDialog` (`fill`, `select`, `fillDate`,
  `check`, `save`, `expectError` — tìm ô theo nhãn).
- Page object của màn chỉ khai phần riêng (mở màn, chọn nút cây, card, tab, toolbar) và trả về
  `DataTable`/`FormDialog` cho phần chung.
- Selector CSS nằm trong page object; spec đọc như kịch bản người dùng.

Mẫu đầy đủ đang chạy: `e2e/quantri/lib-folder.spec.ts` + `e2e/pages/quantri/lib-folder.page.ts`.

## Các hành trình bắt buộc cho mỗi màn

1. Mở màn → tải trang đầu (kiểm tra param `page: '0'`, `orgid`) → bảng hiện đúng dữ liệu.
2. Thêm/sửa: điền form → Lưu → body gửi đi đúng → dialog đóng → danh sách tải lại.
3. Validate: bỏ trống/sai định dạng → lỗi trong dialog → **không** có request ghi.
4. Xóa: Hủy thì không gọi API; Đồng ý thì gọi đúng id.
5. Lỗi backend: `api.fail(...)` → đúng một toast mang nguyên thông báo backend, dữ liệu trên màn giữ nguyên.
6. Quyền: `test.use({ screenPermissions: READ_ONLY })` → không có nút thêm/sửa/xóa.

## Quy trình nhiều bước (backend có trạng thái)

Dùng biến trạng thái trong test và handler `api.on` để mô phỏng vòng đời:

```ts
test('khiếm khuyết: giao xử lý → xử lý xong → nghiệm thu → đóng', async ({ page, api, shell }) => {
  let kk = aKhiemKhuyet({ id: 'KK01', trangThai: 'MOI' });
  api.on('GET', 'khiem-khuyet/detail', () => apiOk(kk));
  api.on('POST', 'khiem-khuyet/chuyen-trang-thai', (call) => {
    kk = { ...kk, trangThai: call.body.trangThaiMoi };
    return apiOk(kk);
  });
  const man = new KhiemKhuyetPage(page);
  await man.open('KK01');

  await man.chuyen('Giao xử lý');
  await man.expectTrangThai('Đang xử lý');
  // ... từng bước, mỗi bước kiểm tra body gửi đi + nút khả dụng ở trạng thái mới
});
```

Chuyển trạng thái bị backend từ chối (`api.fail`) → trạng thái trên màn không đổi.

## File, thời gian, dữ liệu lớn

- Upload: `page.getByLabel('Đính kèm').setInputFiles({ name: 'bien-ban.pdf', mimeType: 'application/pdf', buffer })`
  → kiểm tra request multipart qua `api.lastCall`.
- Download/xuất báo cáo: `const dl = page.waitForEvent('download')` trước khi bấm → kiểm tra `suggestedFilename()`.
- "Hôm nay": `await page.clock.setFixedTime(new Date('2026-09-29T08:00:00+07:00'))` trước `goto`.
- Bảng lớn/AG Grid: test phân trang/cuộn server-side qua param request, không cuộn hết dữ liệu.

## Smoke (backend thật)

- Chỉ đọc: mở màn, tải dữ liệu, không toast lỗi. Không thêm/sửa/xóa.
- Mỗi module khi lên môi trường dev thêm một test vào `e2e/smoke/<module>.spec.ts`, tag `@smoke`.
- Tài khoản qua biến môi trường `E2E_USER` / `E2E_PASSWORD`.

## Chạy & debug

- `npm run e2e` tự bật `ng serve` ở cổng 4300 (không đụng dev server 4200).
- `npm run e2e:ui` — chạy từng bước, xem DOM/request. `npm run e2e:report` — trace của test đỏ.
- Trình duyệt mặc định là Chrome đã cài (`PW_CHANNEL`).
