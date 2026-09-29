---
name: testing
description: 'Quy tắc BẮT BUỘC viết unit test (Vitest) và e2e (Playwright) cho frontend PMIS3: tầng nào test gì, bảng kịch bản, bộ khung src/testing + e2e/fixtures, testability của template, Definition of Done. Kèm danh mục kịch bản cho nghiệp vụ phức tạp: thiết bị, thí nghiệm điện, sự cố khiếm khuyết, sửa chữa bảo dưỡng, RCM, CBM. Đọc khi dựng/sửa chức năng, sửa bug, hoặc viết bất kỳ *.spec.ts nào.'
---

# Testing

Mỗi chức năng giao đi kèm test của nó — code và test là **một** thay đổi. Test là bản đặc tả chạy được:
đọc tên test là biết chức năng làm gì, test đỏ là biết hành vi nào hỏng.

## Stack

| Tầng | Công cụ | Vị trí | Lệnh |
|---|---|---|---|
| Unit | Vitest (builder `@angular/build:unit-test`, browser mode Chrome headless) | `*.spec.ts` cạnh file nguồn | `npm test`, `npm run test:watch` |
| E2E | Playwright, backend giả (`MockApi`) | `e2e/<module>/*.spec.ts` | `npm run e2e`, `npm run e2e:ui` |
| Smoke | Playwright, backend THẬT, tag `@smoke` | `e2e/smoke/` | `E2E_BASE_URL=… E2E_USER=… E2E_PASSWORD=… npm run e2e` |

Bộ khung dùng chung: `src/testing/` (unit) và `e2e/fixtures`, `e2e/pages`, `e2e/support` (e2e).
Bản chuẩn nằm ở repo `pmis3-luoi-frontend-thietbi` — repo khác chưa có thì chép nguyên các thư mục đó
kèm `vitest.config.ts`, `playwright.config.ts`, `src/test-setup.ts`, `scripts/test-unit.mjs`.

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
5. **E2E** — page object của màn + spec các hành trình trong bảng kịch bản. Mẫu: [`E2E.md`](E2E.md).
6. **Sửa bug:** viết test tái hiện, chạy thấy **đỏ**, rồi mới sửa code cho xanh. Test ở lại vĩnh viễn.
7. Chạy `npm test` và `npm run e2e`. *Xong khi:* cả hai xanh và Definition of Done bên dưới đủ dấu.

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
- [ ] Bug đã sửa có test tái hiện
- [ ] Template đạt quy tắc Testability
- [ ] `npm test` và `npm run e2e` xanh; màn mới đã thêm vào smoke (`e2e/smoke/`)

## Tham chiếu

- [`UNIT.md`](UNIT.md) — API `src/testing`, mẫu hàm thuần / service / component / thời gian, bẫy thường gặp.
- [`E2E.md`](E2E.md) — fixture, `MockApi`, page object, mẫu hành trình, quy trình nhiều bước, file, smoke.
- [`DOMAIN.md`](DOMAIN.md) — kịch bản bắt buộc theo module: thiết bị, thí nghiệm, sự cố khiếm khuyết,
  sửa chữa bảo dưỡng, RCM, CBM và các phần dùng chung (trạng thái, cây, ký số, đính kèm, báo cáo).
