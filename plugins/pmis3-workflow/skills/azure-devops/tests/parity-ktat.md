# Đối chiếu azdo.ps1 / azdo.mjs / azdo.sh trên KTAT (2026-10-20)

Project: KTAT (`https://devops.evn.com.vn/EVNCollection/KTAT`), `AZDO_PROJECT=KTAT`. Không PAT nào được ghi lại trong tài liệu này.
Work item thử: **#131429** (Task) "[TEST azdo.sh] parity 2026-10-20" - tạo bằng `azdo.ps1 create Task ... -Yes` (exit 0).

Ba bản chạy:
- `ps1`: `powershell.exe azdo.ps1` (Windows PowerShell 5.1, ép UTF-8 console để so sánh được).
- `mjs`: `node azdo.mjs` (Windows).
- `sh`: `bash azdo.sh` trong Docker `node:24-slim` (Linux, LF; image `azdo-node-git` = node:24-slim + git, chỉ để `finish` kiểm tra push), mạng container phân giải được `devops.evn.com.vn` (không có vấn đề DNS/VPN).

## Kiểu `Task`
KTAT có type `Task` (To Do / In Progress / Done / Removed), và `finish` CÓ quy tắc cho Task (yêu cầu push) nên đường đi là
`finish -Yes` (không cần phương án `state Done`). Chạy ngoài git repo thì `finish` thoát 3 (đúng quy ước) ở cả 3 bản; các lệnh
finish còn lại chạy trong repo thử đã push (`scratchpad/work`, remote bare cục bộ).

## Kết quả

| Lệnh | ps1 | mjs | sh (Linux) | So sánh |
|---|---|---|---|---|
| `whoami` | 0 | 0 | 0 | stdout giống hệt |
| `show 131429` | 0 | 0 | 0 | giống hệt, trừ giờ: container chạy UTC (07:24 so với 14:24) |
| `states Task` | 0 | 0 | 0 | giống hệt |
| `required Task` | 0 | 0 | 0 | giống hệt |
| `finish 131429` (ngoài repo, chạy khô) | 3 | 3 | 3 | giống hệt, trừ đường dẫn thư mục trong dòng "Lý do" |
| `finish 131429` (trong repo đã push, chạy khô) | 0 | 0 | 0 | giống hệt ("CHẠY KHÔ. Sẽ chuyển 'To Do' -> 'Done'") |
| `comment 131429 "..." ` (khô) | 0 | 0 | 0 | giống hệt |
| `comment ... -Yes` | 0 | 0 | 0 | giống hệt (3 comment) |
| `state 131429 "In Progress" -Yes` | 0 (To Do -> In Progress) | 0 (In Progress -> In Progress) | 0 (như mjs) | khác nhau chỉ vì thứ tự chạy (cùng item) |
| `state 131429 Nonexistent` | 1 | 1 | 1 | giống hệt (liệt kê state hợp lệ) |
| `finish 131429 -Comment "Kiểm thử xong" -Yes` | 0 | 0 | 0 | giống hệt (mỗi lần đặt lại In Progress trước; 3 comment "Kiểm thử xong") |

Cuối cùng item được để ở `Done` (bằng `azdo.mjs state ... Done -Yes`).

## Khác biệt và sửa
Không có khác biệt hành vi giữa mjs/sh và ps1 -> **không phải sửa azdo.mjs / azdo-lib.mjs**. Chênh lệch duy nhất là do môi trường (múi giờ UTC của container; đường dẫn cwd).

## Bước 3 (xem trên web) - thay thế
Không mở được trình duyệt; thay bằng `show 131429` + gọi REST `comments` để xem text đã lưu. Kết quả: tiếng Việt, `"nháy"`, `&`, `—`, `✓` đi qua nguyên vẹn
(lưu dạng `Thử tiếng Việt: &quot;nháy&quot; &amp; ... — ✓`, hiển thị lại đúng). **Ngoại lệ:** đoạn `<thẻ>` bị mất ở cả 3 bản
(`... &amp;  — ✓`); thử thêm comment `probe a <abc> b 1<2 c` cho kết quả `probe a  b 1`. Tức là máy chủ Azure DevOps on-prem tự gỡ mọi `<...>` trong comment (System.History) dù
client đã gửi `&lt;...&gt;`. Đây là hành vi phía server, giống hệt giữa ps1 và mjs/sh, không sửa trong phạm vi task này.
