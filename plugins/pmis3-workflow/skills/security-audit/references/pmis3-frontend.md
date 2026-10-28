# Frontend PMIS3 — điểm hay hở

Nguyên tắc nền: **mọi kiểm ở frontend là trải nghiệm người dùng, không phải kiểm soát bảo mật.** Phát hiện ở
frontend về quyền chỉ là thật khi API tương ứng ở backend cũng thiếu kiểm — luôn đối chiếu sang backend
(`pmis3-backend.md`) trước khi kết luận.

## Xác thực, phiên, CSRF

- Token nằm trong cookie do backend đặt (domain `COOKIE_DOMAIN`); `core/interceptors/auth.interceptor.ts` gửi
  `withCredentials: true`. Token **không** được nằm trong `localStorage`, `sessionStorage`, URL hay log console.
- Backend tắt CSRF và chấp nhận token từ cookie → chống CSRF dựa vào `SameSite` của cookie (`CookieUtil` phía
  backend) và CORS. Kiểm:
  - `SameSite=None` → thao tác ghi bị CSRF từ trang khác: phát hiện mức Cao.
  - `SameSite=Lax` không chặn `GET` cấp cao nhất → `GET` có tác dụng ghi dữ liệu là phát hiện.
  - CORS phản chiếu `Origin` bất kỳ kèm `allowCredentials` → phát hiện.
- `localStorage` có `user`, `grantedFunctions`, `selectedOrganization` (store trong `core/store/`): dùng để hiển thị.
  Sửa tay được → báo nhầm nếu backend kiểm; là thật nếu có API chỉ dựa vào giá trị đó.
- Refresh token: retry trong interceptor không lặp vô hạn; đăng xuất gọi backend thu hồi, không chỉ xóa state.

## Quyền chỉ ở giao diện

`canCreate()` / `canUpdate()` / `canDelete()` của `BaseComponent`, route guard, nút ẩn theo đơn vị — chỉ ẩn/hiện.
Với mỗi thao tác ghi mới trong phạm vi, ghi lại endpoint nó gọi và chuyển sang kiểm backend: cặp
`Q_FUNCTION_ENDPOINT` đúng vai trò + kiểm đơn vị của bản ghi.

## XSS

Angular mã hóa `{{ }}` và binding thuộc tính mặc định. Phát hiện XSS gần như luôn đến từ chỗ cố ý vượt cơ chế đó:

- `[innerHTML]` với dữ liệu từ API (Angular làm sạch, nhưng vẫn cho phép HTML định dạng — kiểm nguồn dữ liệu).
- `DomSanitizer.bypassSecurityTrustHtml/Url/ResourceUrl/Script` với dữ liệu không do mã tự sinh → phát hiện Cao.
- `ElementRef.nativeElement.innerHTML = ...`, `insertAdjacentHTML`, `document.write`.
- **AG Grid**: `cellRenderer` trả **chuỗi** được render như HTML — ghép dữ liệu người dùng vào chuỗi đó là XSS.
  Dùng renderer component hoặc `valueFormatter`.
- Trình soạn thảo HTML (WordEditor, `p-editor`): nội dung lưu xuống rồi hiển thị lại cho người khác là XSS lưu trữ
  nếu không làm sạch ở cả lúc hiển thị lẫn lúc xuất PDF.
- `[href]`, `window.open(url)`, `[src]` iframe với URL từ dữ liệu: chặn `javascript:` / `data:`; tải tệp dùng URL
  do backend sinh.

## Chuyển hướng

`returnUrl` / `redirect` từ query param truyền thẳng vào `router.navigateByUrl` hoặc `window.location` → chuyển
hướng mở. Chỉ chấp nhận đường dẫn tương đối bắt đầu bằng `/` và không bắt đầu bằng `//`.

## Bí mật và cấu hình

- `environment*.ts`, `src/assets/configs/config.json`, `config.template.json` đều vào bundle công khai: không chứa
  khóa riêng, mật khẩu, địa chỉ máy chủ nội bộ (FE-07). Cấu hình lúc chạy đi qua `RuntimeConfigService`.
- Cấu hình Firebase web (`apiKey`, `projectId`…) công khai theo thiết kế → báo nhầm; bảo vệ nằm ở rule phía Firebase.
- `e2e/.env.local` (tài khoản test) phải nằm trong `.gitignore` — kiểm bằng `git ls-files`, không đọc.
- Thư viện: `npm audit` sạch; xem `package.json → overrides` trước khi kết luận một CVE còn mở.

## Thông báo lỗi

`errorInterceptor` hiện câu lỗi backend trả về cho người dùng: câu chứa SQL, stack trace, tên máy chủ là phát hiện
ở **backend** (ghi vị trí phía backend).
