# E2E (Playwright)

Tham chiếu của skill [`testing`](SKILL.md). Mọi spec import `test`, `expect` từ `e2e/fixtures`.

## Cấu trúc

```
e2e/
├── fixtures/index.ts        # test.extend: api, shell + option quyền/đơn vị/đăng nhập
├── support/                 # MockApi, seedSession, live-api (dọn dữ liệu backend thật, expectOk)
├── pages/                   # page object DÙNG CHUNG: app-shell, data-table, form-dialog
│   └── <module>/<feature>.page.ts   # page object riêng của màn
├── data/<module>/<feature>.ts       # builder dữ liệu mẫu (kiểu DTO thật)
├── <module>/<feature>.spec.ts       # hành trình với backend giả (project mock)
├── smoke/<module>.spec.ts           # backend thật, CHỈ ĐỌC, tag @smoke (project smoke)
├── live/login.setup.ts              # đăng nhập thật một lần → e2e/.auth/live-user.json
├── live/<module>.spec.ts            # backend thật, GHI dữ liệu + tự dọn (project live)
└── .env.local                       # E2E_USER / E2E_PASSWORD (gitignore; mẫu .env.local.example)
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

## Backend thật (smoke + live)

- **Smoke** (`e2e/smoke/<module>.spec.ts`, `@smoke`): CHỈ ĐỌC — mở màn, nạp dữ liệu, duyệt/tìm, mở chi tiết và
  từng tab, mở rồi đóng các hộp thoại; `afterEach` kiểm không có `.p-toast-message-error`. Không thêm/sửa/xóa.
- **Live** (`e2e/live/<module>.spec.ts`): vòng đời nghiệp vụ chính trên dữ liệu thật — tạo → tìm → mở bằng link
  → sửa → các thao tác nghiệp vụ → ràng buộc bị chặn → xóa. `test.describe.configure({ mode: 'serial' })`;
  dữ liệu mang tiền tố `E2E-` + mã thời gian; `afterAll` LUÔN dọn (kể cả khi bước giữa đỏ) qua
  `e2e/support/live-api.ts` (dùng phiên của trình duyệt).
- Tài khoản ở `e2e/.env.local` (playwright.config tự `process.loadEnvFile`). Thiếu thì `smoke`/`live` tự bỏ qua
  kèm cảnh báo — không được coi là đã chạy.
- FE chạy ở `http://localhost:<cổng>` (KHÔNG `127.0.0.1`) cho smoke/live: backend đặt cookie phiên cho
  `localhost`, khác site thì trình duyệt không gửi cookie. `scripts/serve-e2e.mjs` nghe cả `127.0.0.1` và `::1`.
- Timeout: live 120 s, smoke 60 s mỗi test (backend thật + chỉ mục tìm kiếm cần thời gian).

### Bẫy khi chạy với backend thật

- **"Backend chạy trên máy" ≠ "CSDL trên máy"**: backend local thường nối DB DEV DÙNG CHUNG. Mọi bản ghi live tạo
  ra nằm trên DB chung; xóa thường là XÓA MỀM — dòng vẫn còn và vẫn giữ ràng buộc unique. Hỏi trước khi chạy
  live nếu chưa rõ DB nào.
- **Chờ API, không chờ giao diện, khi giao diện có trạng thái tạm**: vd màn Thiết bị vẽ tạm bảng thiết bị rỗng
  TRƯỚC khi danh sách khu vực về → phải `waitForResponse('/asset/sites')` rồi mới quyết định có chọn khu vực.
- **Đếm dòng sau khi bảng nạp xong** (`.p-datatable-mask` biến mất + có dòng hoặc dòng "không có dữ liệu");
  `locator.count()` không chờ.
- **Giới hạn locator trong vùng chứa**: tên thiết bị xuất hiện cả ở breadcrumb, đường dẫn dưới từng dòng, tiêu
  đề panel — `getByText(ten)` khớp nhiều phần tử. Lấy theo vùng (`crumbBar()`, `detailTitle()`).
- `p-drawer` có role `complementary`, KHÔNG phải `dialog`; tìm theo `.p-drawer, .p-dialog` + tiêu đề.
- **Chỉ mục tìm kiếm (Elasticsearch) trễ**: bản ghi vừa ghi có thể chưa tìm thấy, `childcount` của cha có thể
  chưa cập nhật. Tìm thì `expect.poll` + tìm lại; kiểm quan hệ cha–con / bộ đếm bằng DUYỆT CÂY (SQL), không
  bằng kết quả tìm kiếm.
- Ô tìm kiếm có `distinctUntilChanged`: gõ lại đúng từ khóa cũ (hoặc xóa ô đã trống) KHÔNG gửi request — đừng
  `waitForResponse` cho nó (treo tới hết giờ).
- Kiểm response bằng `expectOk(res)` (`e2e/support/live-api.ts`) để lỗi in nguyên body backend. Gặp
  `500 "Đã xảy ra lỗi hệ thống"` thì lấy stack trace từ console backend — đó là lỗi backend thật cần sửa
  (vd ràng buộc CSDL chưa được kiểm ở service), không phải "test chập chờn".
- Dữ liệu tạo trong test phải đúng ràng buộc nghiệp vụ hiện hành (vd mã thiết bị bắt buộc khi thêm mới) —
  ràng buộc đổi thì sửa test live theo.
- **Backend vừa sửa mà smoke/live đỏ** — đọc mã lỗi trước khi sửa test:
  `404 "Không tìm thấy endpoint …"` = service đang chạy bản cũ (chưa khởi động lại); `500` ở mọi API đọc một
  entity vừa thêm cột = script DDL chưa chạy (kiểm chỉ đọc: `SELECT COL_LENGTH('<BẢNG>','<CỘT>')`);
  endpoint mới bị chặn quyền = chưa chạy script `Q_FUNCTION_ENDPOINT`. Báo người dùng chạy script / khởi động lại.
- **Smoke đỏ ngẫu nhiên khi chạy song song** (mỗi lần một test khác, đều timeout): backend dev chậm. Chạy lại
  `npx playwright test --project=smoke --workers=1` trước khi kết luận; tuần tự vẫn đỏ mới là lỗi thật.
- **Mock trả mọi thứ cùng lúc, backend thật trả lần lượt** — giao diện phụ thuộc số phần tử (gallery, dải
  thumbnail, bộ đếm) có thể chỉ hỏng trên dữ liệu thật. Viết unit test cho kịch bản dữ liệu về dần (mỗi
  request một `Subject`, `next` từng cái).
- **Tái hiện lỗi người dùng báo trên một bản ghi thật** (URL cụ thể) khi không có trình duyệt điều khiển: spec tạm
  `e2e/smoke/zz-debug-<việc>.spec.ts`, tên test mang `@smoke` (project smoke lọc theo tag — thiếu tag thì
  "No tests found"); `page.goto(url)`, log response/DOM bằng `console.log`, đính ảnh bằng `testInfo.attach`
  (ảnh nằm trong `playwright-report/data/`). Tìm ra nguyên nhân → test tái hiện ở unit/mock → sửa → xóa spec tạm.

## Chạy & debug

- `npm run e2e` build bản development rồi phục vụ bản tĩnh ở cổng 4300 (`scripts/serve-e2e.mjs`, không dùng
  `ng serve` vì Vite reload giữa chừng). `E2E_SKIP_BUILD=1` dùng lại bản build cũ khi chỉ sửa spec.
- `npm run e2e:mock` / `e2e:smoke` / `e2e:live` chạy riêng từng project. `E2E_SITE=<mã>` chọn khu vực.
- `npm run e2e:ui` — chạy từng bước, xem DOM/request. `npm run e2e:report` — trace của test đỏ.
- Trình duyệt mặc định là Chrome đã cài (`PW_CHANNEL`).
