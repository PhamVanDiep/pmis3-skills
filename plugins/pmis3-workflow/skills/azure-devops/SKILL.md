---
name: azure-devops
description: 'Đọc bug/ticket/feature từ Azure DevOps Server on-prem của EVN, implement, rồi comment và cập nhật state. Dùng khi người dùng nhắc tới work item, ID ticket, bug, hoặc hỏi "còn việc gì của tôi".'
---

# Azure DevOps (on-prem EVN)

Làm việc với work item trên `https://devops.evn.com.vn/EVNCollection` — đọc yêu cầu,
implement trong repo, rồi cập nhật lại work item.

## Xác thực

Windows Integrated Auth qua `curl.exe --negotiate`. **Không có PAT, không có secret.**
Script chạy bằng đúng quyền của tài khoản Windows đang đăng nhập → `@Me` trong truy vấn
tự trỏ về người dùng hiện tại. Không cần cấu hình gì thêm.

## Lệnh

Script: `azdo.ps1` â€” náº±m cÃ¹ng thÆ° má»¥c vá»›i SKILL.md nÃ y (PowerShell 5.1).

| Lệnh | Việc |
|---|---|
| `azdo.ps1 whoami` | Kiểm tra kết nối + xác định đang đăng nhập bằng ai |
| `azdo.ps1 mine` | Work item gán cho tôi, trong project của repo hiện tại |
| `azdo.ps1 mine -All` | Work item gán cho tôi ở **mọi project** trong collection |
| `azdo.ps1 show <id>` | Chi tiết: mô tả, repro steps, acceptance criteria, thảo luận, đính kèm |
| `azdo.ps1 states <type>` | Liệt kê state hợp lệ của một type |
| `azdo.ps1 comment <id> "<text>" -Yes` | Thêm comment vào Discussion |
| `azdo.ps1 state <id> "<state>" -Yes` | Đổi sang state chỉ định |
| `azdo.ps1 finish <id> -Yes` | Đổi sang state "xong" theo quy ước, có kiểm tra guard |

Bỏ `-Yes` = chạy khô, chỉ in ra dự định. **Luôn chạy khô trước, cho người dùng xem, rồi mới chạy thật.**

Output là `Write-Output` nên **lọc được**. Danh sách dài thì lọc thay vì đọc hết:

```powershell
.\azdo.ps1 mine -All | Select-String -Pattern '\s(Bug|Ticket)\s'
```

## Phạm vi project — QUAN TRỌNG

**Làm ở repo nào thì chỉ đụng work item của project tương ứng.** Project được suy ra từ
`git remote` của repo hiện tại (`.../{Collection}/{Project}/_git/{Repo}`).

Một collection có nhiều project (`CSDLMT`, `PMIS3-NGUON`, `PMIS3-OMS`...) và ID work item
là duy nhất toàn collection, nên **về mặt kỹ thuật** một ID bất kỳ đều tra được từ repo bất kỳ.
Nhưng làm vậy là sai: sửa code repo này rồi cập nhật work item của project khác thì hai bên
lệch nhau. Script tự chặn:

| Tình huống | Hành vi |
|---|---|
| `show` một item thuộc project khác | Vẫn hiện, kèm **CẢNH BÁO** — kiểm tra lại xem có mở nhầm repo không |
| `comment` / `state` / `finish` lên item thuộc project khác | **Chặn, exit 4.** Phải mở repo thuộc project đó rồi chạy lại |
| Thật sự cần ghi xuyên project | Thêm cờ `-CrossProject`, và **chỉ khi người dùng yêu cầu rõ** |

`mine` mặc định chỉ lấy project của repo hiện tại — đây là hành vi đúng, giữ nguyên.
`mine -All` quét cả collection: **chỉ dùng khi người dùng hỏi rõ là muốn xem hết mọi project**
(kiểu "tất cả việc của tôi ở mọi dự án"). Câu hỏi thường như "còn việc gì của tôi" →
dùng `mine` thường, không dùng `-All`.

## Quy ước cập nhật state

Khai báo trong `azdo.config.json`. Chỉ tự đổi khi state **hiện tại** nằm trong `allowedFrom`:

| Type | Tự xử lý khi đang ở | Xong → |
|---|---|---|
| Bug | New · In Progress · Reopened | **Committed** (phải push code trước) |
| Task | To Do · In Progress | **Done** |
| Ticket | New · Ready · Approved · Designed · In Progress · Accepted | **Done** |
| Issue | New · In Progress · Reopened | **Resolved** |
| Product Backlog Item | New · Approved · In Progress · Designed | **Committed** |

`finish` tự kiểm tra và **thoát với mã lỗi** khi không được phép:

| Exit | Nghĩa | Phải làm gì |
|---|---|---|
| `2` | State hiện tại ngoài `allowedFrom`, hoặc type không có quy ước | Script đã in sẵn bảng state — **hỏi người dùng chọn**, rồi chạy `state <id> "<tên>" -Yes` |
| `3` | Bug nhưng code chưa push hết | Push xong mới chạy lại. **Không** lách bằng `state` |
| `4` | Item thuộc project khác với repo hiện tại | Mở đúng repo rồi chạy lại. **Không** tự thêm `-CrossProject` |

## Quy trình

1. **Đọc** — `show <id>`. Không có ID thì `mine -All` để người dùng chọn.
2. **Xác nhận** — tóm tắt lại yêu cầu theo cách mình hiểu, hỏi người dùng đúng chưa
   **trước khi** viết code. Mô tả work item thường ngắn và thiếu ngữ cảnh.
3. **Implement** — theo đúng rule của repo (`.claude/rules/`, `CLAUDE.md`, wiki).
4. **Push** — nếu là Bug thì bắt buộc, vì `finish` sẽ chặn khi còn commit chưa push.
5. **Comment** — ghi lại đã sửa gì, ở đâu. Chạy khô cho người dùng xem trước.
6. **Đổi state** — `finish <id>`. Chạy khô trước, `-Yes` sau khi người dùng đồng ý.

## Bốn ràng buộc bắt buộc

1. **Không ghi khi chưa được đồng ý.** Mọi `comment` / `state` / `finish -Yes` phải được
   người dùng xác nhận ở lượt trước đó. Không tự resolve.
2. **Exit 2 → hỏi, không đoán.** Script in sẵn bảng state kèm số thứ tự; đưa nguyên bảng
   đó cho người dùng chọn. Không tự suy diễn state nào "hợp lý".
3. **Exit 3 → push, không lách.** Không dùng `state` để vượt qua guard push của Bug.
4. **Không đụng PR và pipeline.** Ngoài phạm vi bộ công cụ này.
5. **Không ghi xuyên project.** Repo nào làm việc của project đó. Gặp exit 4 thì báo người dùng
   mở đúng repo, không tự lách bằng `-CrossProject`.

## Lưu ý kỹ thuật

- `ConvertFrom-Json` của PowerShell 5.1 **chết** trên payload lớn / có key rỗng của Azure DevOps.
  Script dùng `JavaScriptSerializer` (trả về `Dictionary` lồng nhau, truy cập bằng `['key']`).
- File `azdo.ps1` phải giữ **UTF-8 có BOM**, nếu không PowerShell 5.1 đọc sai tiếng Việt.
  Sửa file xong nhớ ghi lại kèm BOM.
- Body gửi lên Azure DevOps phải là **UTF-8 không BOM**, nếu không API từ chối JSON.
- Comment ghi qua field `System.History` (`PATCH` với `application/json-patch+json`) —
  cách này chạy trên mọi phiên bản Azure DevOps Server.
