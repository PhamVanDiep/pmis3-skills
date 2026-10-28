# Bảng tra 04 nhóm lỗi bắt buộc

Mỗi hạng mục có **câu hỏi xác minh** — công cụ lọc báo nhầm nhanh nhất: không trả lời được câu hỏi thì phần lớn
là báo nhầm. Cách hạng mục hiện ra trong mã PMIS3: xem `pmis3-backend.md` và `pmis3-frontend.md`.

## Nhóm (i) — OWASP Top 10 (bản 2021, đối chiếu bản mới hơn nếu đã công bố)

| # | Hạng mục | Dấu hiệu trong mã | Câu hỏi xác minh |
|---|---|---|---|
| A01 | Kiểm soát truy cập | Endpoint thiếu kiểm quyền; quyền chỉ kiểm ở giao diện; định danh đối tượng lấy từ tham số mà không đối chiếu phạm vi người dùng | Người dùng A sửa tham số có truy cập được dữ liệu của B không? |
| A02 | Lỗi mật mã | Băm mật khẩu yếu (MD5/SHA1 không salt); mã hóa tự viết; khóa cố định trong mã; dữ liệu nhạy cảm truyền không mã hóa | Dữ liệu nào được bảo vệ bằng cơ chế này? Cơ chế còn được khuyến nghị không? |
| A03 | Tiêm nhiễm | Xem nhóm (iv) | |
| A04 | Thiết kế thiếu an toàn | Không giới hạn số lần thử; bước quan trọng không xác thực lại; tin dữ liệu tính toán từ máy khách | Kịch bản lạm dụng nào thiết kế không lường trước? |
| A05 | Cấu hình sai | CORS quá rộng; Swagger/actuator mở ở môi trường thật; trang lỗi lộ stack trace | Cấu hình này có khác giữa dev và môi trường thật không? |
| A06 | Thành phần lỗi thời | Thư viện có CVE đã công bố (`npm audit`, `./mvnw dependency:tree` + Trivy) | Đoạn mã lỗi của thư viện có nằm trên đường thực thi ứng dụng dùng không? |
| A07 | Xác thực và định danh | Token không hết hạn; đăng xuất không hủy refresh token; OTP không giới hạn số lần nhập | Sau đăng xuất, token cũ còn dùng được không? |
| A08 | Toàn vẹn phần mềm/dữ liệu | Giải tuần tự dữ liệu không tin cậy; tải script từ CDN không có integrity; tệp import không kiểm cấu trúc | Dữ liệu đưa vào đến từ đâu, người ngoài kiểm soát được không? |
| A09 | Thiếu log/giám sát | Không ghi log đăng nhập thất bại, đổi quyền, xóa dữ liệu | Nếu bị tấn công, còn dấu vết nào để điều tra? |
| A10 | SSRF | Máy chủ gọi tới URL do người dùng cung cấp | Người dùng điều khiển được địa chỉ đích của lời gọi không? |

## Nhóm (ii) — Lộ thông tin nhạy cảm

| # | Điểm kiểm | Nơi hay gặp | Câu hỏi xác minh |
|---|---|---|---|
| 1 | Mật khẩu, API key, token, khóa riêng viết cứng | Mã nguồn, `application*.yml`, script triển khai, tệp test | Bí mật thật hay giá trị giả trong test? |
| 2 | Chuỗi kết nối CSDL | Cấu hình mọi môi trường, kể cả TEST | Chuỗi này kết nối được tới hệ thống thật không? |
| 3 | Bí mật trong lịch sử Git | Commit cũ, kể cả khi tệp đã xóa (`git log --all -p -S '<mẫu>'`) | Đã từng được đẩy lên remote chưa? |
| 4 | Bí mật trong chú thích | Chú thích tạm khi gỡ lỗi | |
| 5 | PII trong log, thông báo lỗi, dữ liệu test | `log.info(...)`, fixture test | Dữ liệu giả sinh mới hay dữ liệu thật đã che một phần? |
| 6 | Địa chỉ máy chủ nội bộ | Mã frontend, tệp cấu hình đóng gói vào bản build | Địa chỉ có thuộc mạng nội bộ và có lọt vào bundle trình duyệt không? |
| 7 | Lộ nội bộ qua phản hồi lỗi | `e.getMessage()` / câu SQL / tên máy chủ trả về client | Người dùng thấy được chi tiết gì khi gây lỗi? |

## Nhóm (iii) — Xác thực và phân quyền

| # | Điểm kiểm | Dấu hiệu | Câu hỏi xác minh |
|---|---|---|---|
| 1 | Endpoint công khai ngoài ý muốn | Nằm trong whitelist / `permitAll` mà không có lý do | Gọi khi chưa đăng nhập có trả dữ liệu không? |
| 2 | Quyền chỉ kiểm ở giao diện | Nút ẩn theo `canDelete()` nhưng API không kiểm | Gọi thẳng API bằng curl có thực hiện được không? |
| 3 | IDOR | Truy vấn/sửa theo `id` từ tham số, không lọc theo phạm vi người dùng | Đổi `id` có xem/sửa được dữ liệu người khác không? |
| 4 | Vượt phạm vi đơn vị | Có quyền chức năng nhưng bản ghi thuộc đơn vị không được gán | Người cùng vai trò ở đơn vị khác có sửa được bản ghi này không? |
| 5 | Leo thang dọc | Quyền xem làm được thao tác ghi; người thường gọi được API quản trị | Người chỉ có quyền xem có ghi được không? |
| 6 | Phiên/token | Token trong URL hoặc `localStorage`; không hết hạn; không thu hồi | |
| 7 | Không giới hạn tần suất | Đăng nhập, OTP, quên mật khẩu, xuất dữ liệu lớn | Thử được bao nhiêu lần trong một phút? |

## Nhóm (iv) — SQL Injection và XSS

| # | Điểm kiểm | Dấu hiệu | Câu hỏi xác minh |
|---|---|---|---|
| 1 | Ghép chuỗi SQL | Nối/nội suy chuỗi vào `nativeQuery`, `createNativeQuery`, `JdbcTemplate` | Giá trị nối vào có nguồn từ đầu vào người dùng không? |
| 2 | Truy vấn động | Cộng chuỗi điều kiện `WHERE` | |
| 3 | Tên cột/bảng từ đầu vào | Sắp xếp theo tên cột do client gửi | Có kiểm bằng danh sách trắng không? |
| 4 | Render HTML thô | `[innerHTML]`, `bypassSecurityTrust*`, renderer trả chuỗi HTML | Nội dung do ai nhập? Đã qua làm sạch chưa? |
| 5 | URL từ dữ liệu | `[href]`, `window.open`, `navigateByUrl` với giá trị từ API/query param | Chặn được `javascript:` và địa chỉ ngoài không? |
| 6 | Chuyển hướng mở | `returnUrl` do người dùng cung cấp | Có kiểm đích nằm trong ứng dụng không? |
