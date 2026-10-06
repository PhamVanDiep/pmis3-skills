---
name: testing
description: 'Quy tắc BẮT BUỘC viết/sửa unit test (Vitest), smoke test và e2e (Playwright, backend giả + backend thật) cho frontend PMIS3 mỗi khi xây mới HOẶC hiệu chỉnh chức năng: tầng nào test gì, bảng kịch bản, bộ khung src/testing + e2e/fixtures, testability của template, Definition of Done. Kèm danh mục kịch bản cho nghiệp vụ phức tạp: thiết bị, thí nghiệm điện, sự cố khiếm khuyết, sửa chữa bảo dưỡng, RCM, CBM. Đọc khi dựng/sửa chức năng, sửa bug, hoặc viết bất kỳ *.spec.ts nào.'
---

# Testing

Mỗi chức năng giao đi kèm test của nó — code và test là **một** thay đổi. Test là bản đặc tả chạy được:
đọc tên test là biết chức năng làm gì, test đỏ là biết hành vi nào hỏng.

> **BẮT BUỘC — xây mới HOẶC hiệu chỉnh chức năng:** viết/sửa đủ **unit test + smoke test + e2e test** và chạy
> xanh trước khi báo xong. Sửa hành vi thì sửa luôn test cũ đang mô tả hành vi đó — không xóa, không `skip`
> cho qua. Ràng buộc nghiệp vụ (bắt buộc nhập, không trùng…) chặn ở CẢ giao diện lẫn backend, mỗi phía một
> test. Tầng nào không chạy được (backend tắt, thiếu tài khoản) thì báo rõ tầng đó CHƯA chạy — chưa phải xong.
> Backend: skill `pmis3-backend:testing`.

## Stack

| Tầng | Công cụ | Vị trí | Lệnh |
|---|---|---|---|
| Unit | Vitest (builder `@angular/build:unit-test`, browser mode Chrome headless) | `*.spec.ts` cạnh file nguồn | `npm test`, `npm run test:watch` |
| E2E (mock) | Playwright, backend giả (`MockApi`) — project `mock` | `e2e/<module>/*.spec.ts` | `npm run e2e:mock`, `npm run e2e:ui` |
| E2E (live) | Playwright, backend THẬT, GHI dữ liệu, tự dọn — project `live` | `e2e/live/<module>.spec.ts` | `npm run e2e:live` |
| Smoke | Playwright, backend THẬT, CHỈ ĐỌC, tag `@smoke` — project `smoke` | `e2e/smoke/<module>.spec.ts` | `npm run e2e:smoke` |

`smoke` và `live` đăng nhập thật một lần (project `setup`, `e2e/live/login.setup.ts`) bằng tài khoản trong
`e2e/.env.local` (gitignore; mẫu `e2e/.env.local.example`). Thiếu tài khoản thì hai project này tự bỏ qua.
`npm run e2e` chạy cả ba. Chi tiết và bẫy khi chạy với backend thật: [`E2E.md`](E2E.md#backend-thật-smoke--live).

Bộ khung dùng chung: `src/testing/` (unit) và `e2e/fixtures`, `e2e/pages`, `e2e/support` (e2e).
Bản chuẩn: `pmis3-nguon-frontend` (đủ cả mock / smoke / live, mẫu module Thiết bị: `e2e/pages/thietbi`,
`e2e/smoke/thiet-bi.spec.ts`, `e2e/live/thiet-bi.spec.ts`) và `pmis3-luoi-frontend-thietbi` (cùng cấu hình
mock / smoke / live, backend `localhost:8387`).
Repo khác chưa có thì chép nguyên các thư mục đó kèm `vitest.config.ts`, `playwright.config.ts`,
`src/test-setup.ts`, `scripts/test-unit.mjs`, `scripts/serve-e2e.mjs`.

## Quy trình khi dựng hoặc sửa một chức năng

1. **Lập bảng kịch bản** trước khi viết code — một bảng trong mô tả PR/work item, mỗi dòng một hành vi,
   ghi tầng test sẽ phủ nó. Nhóm dòng theo: luồng chính · validate · quyền · lỗi backend · biên dữ liệu
   (rỗng, 1 bản ghi, nhiều trang) · nghiệp vụ đặc thù. Chức năng thuộc module nghiệp vụ phức tạp → đọc
   [`DOMAIN.md`](DOMAIN.md) và đưa đủ các kịch bản bắt buộc của module đó vào bảng.
   *Xong khi:* mỗi quy tắc nghiệp vụ, mỗi trạng thái và mỗi quyền trong SPEC/thiết kế có ít nhất một dòng.
2. **Tách logic nghiệp vụ thành hàm thuần** trong `<feature>.logic.ts` (tính toán, phân loại, đánh giá
   ngưỡng, chuyển trạng thái hợp lệ, dựng cây…). Component chỉ gọi hàm đó. Viết unit test dạng bảng
   (`it.each`) cho hàm thuần. *Xong khi:* mọi nhánh và mọi giá trị biên trong bảng kịch bản có một dòng `it.each`.
3. **Service spec** — endpoint, method, tên/giá trị param, body. Mẫu: [`UNIT.md`](UNIT.md#service).
4. **Component spec** chỉ cho logic riêng của component (ẩn/hiện theo quyền × trạng thái, validate chéo
   field, tính toán hiển thị). Mẫu: [`UNIT.md`](UNIT.md#component).
5. **E2E + smoke** — page object của màn (`e2e/pages/<module>/`) + ba loại spec: hành trình với backend giả
   (ca khó dựng trên dữ liệu thật: lỗi backend, thiếu quyền), smoke chỉ đọc, và vòng đời nghiệp vụ chính với
   backend thật (`e2e/live/`). Mẫu: [`E2E.md`](E2E.md).
6. **Sửa bug:** viết test tái hiện, chạy thấy **đỏ**, rồi mới sửa code cho xanh. Test ở lại vĩnh viễn.
7. Chạy `npm test`, `npm run e2e:mock`, `npm run e2e:smoke`, `npm run e2e:live` và báo kết quả THẬT (số test,
   xanh/đỏ, tầng nào chưa chạy được). *Xong khi:* tất cả xanh và Definition of Done bên dưới đủ dấu.

## Tầng nào test gì

| Tầng | Phủ | Không phủ |
|---|---|---|
| Hàm thuần `*.logic.ts` | Mọi quy tắc nghiệp vụ, mọi biên ngưỡng, mọi ô bảng quyết định | — |
| Service | Endpoint + method, `page` 0-based, `keyword: ''`, id qua query param, body, header `orgid` | Logic hiển thị |
| Component | Quyền × trạng thái → nút nào hiện; validate chéo field; dữ liệu truyền vào chart/grid | Render của PrimeNG, CSS |
| E2E (mock) | Hành trình người dùng; request gửi đi đúng; lỗi backend hiện đúng; ma trận quyền | Từng nhánh tính toán (đã ở unit) |
| Smoke | Mở được màn, tải được dữ liệu thật, không toast lỗi | Thêm/sửa/xóa dữ liệu thật |

Quy tắc phân bổ: nhánh logic đi xuống tầng thấp nhất phủ được nó; e2e giữ số test nhỏ, mỗi test một
hành trình trọn vẹn.

## Testability — quy tắc cho template

Test và trình đọc màn hình tìm phần tử theo cùng một cách, nên template viết cho cả hai:

- Mọi ô nhập có nhãn gắn liền: `<label for="x">` + `id="x"` (input thường) hoặc `inputId="x"` (`p-select`,
  `p-datepicker`, `p-inputnumber`, `p-checkbox`…). Id có tiền tố theo dialog (`folder-libfolderdesc`).
- Nút chỉ có icon mang `ariaLabel` (`p-button`) hoặc `aria-label` (`<button>`) trùng chữ của `pTooltip`.
- Dialog có `header` — test mở dialog theo tiêu đề.
- Thông báo lỗi validate là chữ hiển thị trong dialog, nội dung ổn định.
- `data-testid` chỉ dùng cho phần tử không có vai trò/nhãn hợp lý (ô canvas, ô biểu đồ, marker bản đồ).

## Quy tắc viết test

- **Tên test tiếng Việt, mô tả hành vi + kết quả**: `'quá hạn 30 ngày thì khiếm khuyết chuyển QUÁ HẠN'`.
  Một test một hành vi.
- **Kiểm tra cả hai mặt**: thứ người dùng thấy (bảng, dialog, toast, nút) và thứ họ không thấy (request gửi
  đi: param, body, header).
- **Dữ liệu qua builder** có kiểu DTO thật (`builder<T>()` trong `src/testing/builders`); test chỉ ghi đè
  field tạo nên khác biệt.
- **Locator theo thứ tự**: `getByRole` → `getByLabel` → `getByPlaceholder`/`getByText` → `data-testid`.
  Class CSS của PrimeNG chỉ nằm trong page object dùng chung (`e2e/pages/*`), spec gọi qua page object.
- **Chờ theo điều kiện**: `expect(...).toBeVisible()`, `expect.poll(...)`, `api.waitForCall(...)`.
- **Test độc lập**: mỗi test tự khai mock nó cần, chạy được riêng lẻ và song song.
- **Giá trị nghiệp vụ có nguồn**: ngưỡng, hệ số, chu kỳ lấy từ SPEC/quy trình, ghi nguồn trong comment
  của bảng `it.each`.
- **Thời gian cố định**: logic phụ thuộc "hôm nay" dùng `useFixedTime()`; e2e dùng `page.clock`.

## Definition of Done (dán vào PR)

- [ ] Bảng kịch bản có trong PR/work item, mỗi dòng đã có test tương ứng
- [ ] Logic nghiệp vụ nằm trong hàm thuần, có unit test dạng bảng phủ mọi biên
- [ ] Service có spec cho mọi method mới/sửa
- [ ] Mỗi màn mới có page object + e2e: luồng chính, validate, lỗi backend, ít nhất một ca thiếu quyền
- [ ] Smoke chỉ đọc cho màn (`e2e/smoke/<module>.spec.ts`) và e2e vòng đời với backend thật (`e2e/live/`)
- [ ] Hiệu chỉnh chức năng: test cũ của hành vi bị đổi đã sửa theo, test mới cho hành vi mới
- [ ] Ràng buộc nghiệp vụ mới có test ở cả giao diện (nút khóa / dấu `*`) lẫn backend (400, `pmis3-backend:testing`)
- [ ] Bug đã sửa có test tái hiện
- [ ] Template đạt quy tắc Testability
- [ ] `npm test`, `npm run e2e:mock`, `npm run e2e:smoke`, `npm run e2e:live` xanh — kết quả ghi vào PR
- [ ] `npm run lint` 0 error; code mới không thêm cảnh báo (`no-explicit-any`, `prefer-inject`, a11y template)

## Tham chiếu

- [`UNIT.md`](UNIT.md) — API `src/testing`, mẫu hàm thuần / service / component / thời gian, bẫy thường gặp.
- [`E2E.md`](E2E.md) — fixture, `MockApi`, page object, mẫu hành trình, quy trình nhiều bước, file, smoke.
- [`DOMAIN.md`](DOMAIN.md) — kịch bản bắt buộc theo module: thiết bị, thí nghiệm, sự cố khiếm khuyết,
  sửa chữa bảo dưỡng, RCM, CBM và các phần dùng chung (trạng thái, cây, ký số, đính kèm, báo cáo).
