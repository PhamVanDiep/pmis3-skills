---
name: ado-done
description: 'Đánh dấu work item Azure DevOps (bug, task, ticket, PBI/item…) đã xong hoặc chuyển sang một trạng thái chỉ định, kèm comment tổng kết và bù đủ field bắt buộc của bước chuyển. Dùng khi người dùng nói "done ticket", "xong bug này", "chuyển ticket sang Done/Committed/In Progress", "đánh dấu hoàn thành"… Không có ID thì lấy work item vừa làm trong phiên. Bug/Task xong → Committed, Ticket/Item xong → Done; có nêu state thì theo state đó.'
---

# Skill: Đánh dấu work item xong / chuyển trạng thái

Bước cuối của quy trình `azure-devops`: chốt lại work item sau khi code đã làm. Skill này **chỉ lo
việc chốt** — đọc/implement vẫn theo skill `pmis3-workflow:azure-devops`.

Script: `../azure-devops/azdo.ps1` (cùng plugin). Quy ước state trong `../azure-devops/azdo.config.json`.

## Đầu vào

| Tham số | Bắt buộc | Cách lấy khi thiếu |
|---|---|---|
| **ID work item** | không | Work item **vừa làm trong phiên**: ID gần nhất đã `show` / implement / comment, hoặc ID xuất hiện trong commit message vừa tạo (`#123742`). Không suy ra được → **hỏi**, không đoán. |
| **State đích** | không | Người dùng nêu tên state ("chuyển sang In Progress", "để Later") → dùng đúng state đó. Không nêu → **state xong theo type** (bảng dưới). |
| **Nội dung comment** | không | Tự soạn từ việc đã làm trong phiên (mục *Comment tổng kết*). |

## State xong theo type

Đọc từ `azdo.config.json`, mục `workflow.<type>.doneState`. Hiện tại:

| Type | Xong → | Điều kiện |
|---|---|---|
| Bug | **Committed** | Code phải **push** hết (`requirePush`) — Committed nghĩa là "đã lên nhánh, chờ kiểm thử" |
| Task | **Done** | Muốn Committed như Bug nhưng type Task của PMIS3-NGUON chỉ có To Do / In Progress / Done |
| Ticket | **Done** | |
| Product Backlog Item | **Done** | |
| Issue | **Resolved** | |

`finish` tự tra bảng này. Type không có trong bảng, hoặc state hiện tại ngoài `allowedFrom` → script
thoát 2 kèm danh sách state → **đưa nguyên danh sách cho người dùng chọn**.

Người dùng **nêu state cụ thể** → dùng `state <id> "<state>"` thay `finish`; script kiểm tra state có
hợp lệ với type không, sai thì in danh sách để chọn lại.

## Quy trình

1. **Xác định ID** theo bảng đầu vào. `show <id>` để biết type, state hiện tại, project.
   Item thuộc project khác repo → script chặn (exit 4) → báo người dùng mở đúng repo, **không** thêm
   `-CrossProject`.
2. **Soạn comment tổng kết** (bắt buộc có, trừ khi người dùng bảo không cần):
   - Đã làm gì, ở repo nào, commit nào (hash + nhánh), file/thư mục chính.
   - Điểm lệch so với mô tả work item và lý do (ví dụ hiểu `ACTIVE=1` là lỗi gõ → đặt `0`).
   - Việc còn lại phía người dùng: chạy script SQL, bump version, push, cấu hình…
   - Viết Markdown gọn (script chuyển sang HTML). Nhiều dòng thì để trong here-string `@'…'@`.
3. **Chạy khô**:
   ```powershell
   .\azdo.ps1 finish <id> -Comment "<tổng kết>"                       # xong theo type
   .\azdo.ps1 state  <id> "<State>" -Comment "<tổng kết>"             # state người dùng chỉ định
   ```
   Cho người dùng xem: state hiện tại → đích, comment, field sẽ ghi.
4. **Chạy thật** với `-Yes` **chỉ sau khi người dùng đồng ý** (một câu "ok / done / commit đi" ở lượt
   trước là đủ). Comment và state ghi **cùng một lượt PATCH** nên không có tình trạng comment xong
   mà state thất bại.
5. **Bù field bắt buộc** nếu script thoát **5**: Azure DevOps đòi field `X` cho bước chuyển này
   (`TF401320: Rule Error for field X`).
   - Suy ra được từ ngữ cảnh → điền: `-Field "X=<giá trị>"` (lặp được nhiều `-Field`).
   - Không suy ra được → **hỏi người dùng**, không bịa. Gợi ý giá trị quen: `Microsoft.VSTS.Common.Severity=3 - Medium`,
     `Microsoft.VSTS.Common.ResolvedReason=Fixed`, `Microsoft.VSTS.Common.Priority=2`.
   - Chạy lại đúng lệnh cũ, thêm `-Field`, vẫn `-Yes`.
   - Field luôn bắt buộc của một type tra trước bằng `.\azdo.ps1 required <Type>`; field chỉ bắt
     buộc ở một bước chuyển thì API không liệt kê, chỉ biết qua exit 5.
6. **Báo lại** một dòng: `#<id> [<type>]: '<cũ>' → '<mới>'`, đã comment, còn gì người dùng phải làm.

## Mã thoát của script

| Exit | Nghĩa | Làm gì |
|---|---|---|
| 0 | Xong | Báo kết quả |
| 1 | State đích không hợp lệ với type | Đưa danh sách state cho người dùng chọn |
| 2 | State hiện tại ngoài `allowedFrom` hoặc type không có quy ước | Đưa danh sách state cho người dùng chọn, rồi dùng `state` |
| 3 | Bug nhưng còn commit chưa push | Nhắc push; **không** lách bằng `state` |
| 4 | Item thuộc project khác | Mở đúng repo; không `-CrossProject` |
| 5 | Thiếu field bắt buộc của bước chuyển | Bước 5 ở trên |

## Ví dụ

```powershell
# "Done ticket" — ticket vừa làm là #123742
.\azdo.ps1 finish 123742 -Comment @'
Đã hiệu chỉnh chức năng công ty đối tác (frontend 9cf4f60, backend-quantri 5233d87, nhánh dev).
Còn lại: chạy scripts/alter_company_org_123742.sql, bump version pmis3-nguon-info-entity.
'@
# … người dùng đồng ý …
.\azdo.ps1 finish 123742 -Comment @'…'@ -Yes

# "Bug 125001 xong rồi" — Bug → Committed, script kiểm tra push trước

# "Chuyển 123742 sang In Progress, ghi chú đang chờ BA xác nhận"
.\azdo.ps1 state 123742 "In Progress" -Comment "Đang chờ BA xác nhận yêu cầu mục 3" -Yes

# Exit 5: "Rule Error for field Microsoft.VSTS.Common.ResolvedReason"
.\azdo.ps1 finish 125001 -Comment "…" -Field "Microsoft.VSTS.Common.ResolvedReason=Fixed" -Yes
```

## Không được

- Ghi (`-Yes`) khi người dùng chưa đồng ý ở lượt trước.
- Đoán ID khi phiên không có work item nào rõ ràng.
- Đoán giá trị field bắt buộc mang nghĩa nghiệp vụ (Severity, Reason…) mà không hỏi.
- Dùng `state` để vượt guard push của Bug (exit 3).
- Bỏ qua comment tổng kết — người đọc work item sau này không có ngữ cảnh phiên chat.
