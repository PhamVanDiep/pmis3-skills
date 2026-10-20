---
name: azure-devops
description: 'Đọc bug/ticket/feature từ Azure DevOps Server on-prem của EVN, implement, rồi comment và cập nhật state. Dùng khi người dùng nhắc tới work item, ID ticket, bug, hoặc hỏi "còn việc gì của tôi".'
---

# Azure DevOps (on-prem EVN)

Làm việc với work item trên `https://devops.evn.com.vn/EVNCollection` — đọc yêu cầu,
implement trong repo, rồi cập nhật lại work item.

## Xác thực — PAT trong file credentials

Script xác thực bằng **Personal Access Token (PAT)**, không dùng mật khẩu Windows. PAT chỉ cấp
scope **Work Items (Read & Write)** nên dù lộ cũng không đụng được code, pipeline hay tài khoản
domain. `@Me` trong truy vấn vẫn trỏ về chủ PAT.

Thứ tự tìm PAT (dừng ở nơi đầu tiên có):

| Thứ tự | Nơi | Dành cho |
|---|---|---|
| 1 | Biến môi trường `AZDO_PAT` | CI, hoặc phiên tạm |
| 2 | `azdo.credentials.json` **cạnh `azdo.ps1`** — đã gitignore | Người làm việc trên checkout repo này |
| 3 | `%USERPROFILE%\.claude\azdo.credentials.json` | Người cài plugin qua marketplace — thư mục cache plugin bị ghi đè mỗi lần `plugin update`, để PAT ở đây thì không mất |

Nội dung file (copy từ `azdo.credentials.example.json`):

```json
{ "pat": "xxxxxxxxxxxxxxxx" }
```

**Chưa có PAT thì script dừng ngay với hướng dẫn tạo** — không có cơ chế fallback sang mật khẩu
Windows. Khi người dùng gặp lỗi này, hướng dẫn họ:

1. Mở `https://devops.evn.com.vn/EVNCollection/_usersSettings/tokens` → **New Token**.
2. Scope: chỉ tick **Work Items → Read & Write**. Không chọn Full access.
3. Lưu vào một trong hai file ở bảng trên. **Không** dán PAT vào chat, vào commit, hay vào
   `azdo.config.json`.

HTTP `401` = PAT sai, hết hạn, hoặc thiếu scope → tạo PAT mới, không thử sửa script.

## Lệnh

Hai script cùng thư mục với SKILL.md này, **cùng lệnh, cùng cờ, cùng mã thoát**:

| Môi trường | Script |
|---|---|
| Windows | `azdo.ps1` (PowerShell 5.1) |
| Linux / macOS / container | `bash azdo.sh` (cần Node ≥ 18; `azdo.sh` chỉ là lớp bọc gọi `azdo.mjs`) |

**Chạy script bằng đường dẫn tuyệt đối** (thư mục chứa skill này), và **giữ cwd ở repo đang làm việc**
(hoặc thư mục cha chứa các repo + `AZDO_PROJECT`) — script lấy project và kiểm tra push theo cwd.
**Không `cd` vào thư mục skill.** Ví dụ: `bash "<thư mục skill>/azdo.sh" mine` /
`& "<thư mục skill>zdo.ps1" mine`. Nội dung có khoảng trắng phải đặt trong nháy kép
(thừa đối số thì script báo lỗi `Thừa đối số`).

Cờ giữ kiểu PowerShell (một gạch, không phân biệt hoa thường) ở cả hai script, ví dụ
`bash "<thư mục skill>/azdo.sh" finish 123 -Comment "..." -Yes`. Các ví dụ dưới đây viết tắt `azdo.ps1`
(đường dẫn đầy đủ: `& "<thư mục skill>zdo.ps1"`); trên bash thay bằng `bash "<thư mục skill>/azdo.sh"`.

| Lệnh | Việc |
|---|---|
| `azdo.ps1 whoami` (bash: `bash "<thư mục skill>/azdo.sh" whoami`) | Kiểm tra kết nối + xác định đang đăng nhập bằng ai |
| `azdo.ps1 mine` | Work item gán cho tôi, trong project của repo hiện tại |
| `azdo.ps1 mine -All` | Work item gán cho tôi ở **mọi project** trong collection |
| `azdo.ps1 show <id>` | Chi tiết: mô tả, repro steps, acceptance criteria, thảo luận, đính kèm |
| `azdo.ps1 states <type>` | Liệt kê state hợp lệ của một type |
| `azdo.ps1 required <type>` | Field luôn bắt buộc (alwaysRequired) của một type |
| `azdo.ps1 comment <id> "<text>" -Yes` | Thêm comment vào Discussion |
| `azdo.ps1 state <id> "<state>" -Yes` | Đổi sang state chỉ định |
| `azdo.ps1 finish <id> -Yes` | Đổi sang state "xong" theo quy ước, có kiểm tra guard |
| `azdo.ps1 create <type> "<title>" -Yes` | Tạo work item mới |
| `azdo.ps1 link <id> -Parent\|-Related\|-BlockedBy <ids> -Yes` | Nối quan hệ giữa các work item |

`state` và `finish` nhận thêm `-Comment "<text>"` (ghi Discussion cùng lượt) và `-Field "Tên=Giá trị"`
(bù field bắt buộc của bước chuyển) — chốt work item thì dùng skill `pmis3-workflow:ado-done`.

Bỏ `-Yes` = chạy khô, chỉ in ra dự định. **Luôn chạy khô trước, cho người dùng xem, rồi mới chạy thật.**

### Tạo work item

Bash (tương đương): `bash "<thư mục skill>/azdo.sh" create Task "T1 — Nghiên cứu X" -DescriptionFile ./t1.md -Tags "wayfinder:research" -Parent 122698 -Yes`

```powershell
# Mô tả dài thì để trong file Markdown, script tự chuyển sang HTML.
.\azdo.ps1 create Task "T1 — Nghiên cứu X" -DescriptionFile .\t1.md -Tags "wayfinder:research" -Parent 122698 -Yes

# Mô tả ngắn thì truyền thẳng.
.\azdo.ps1 create Ticket "Tiêu đề" -Description "Một dòng" -Related 118858 -Yes
```

Cờ dùng được với `create`: `-Description`, `-DescriptionFile`, `-Tags`, `-AssignTo`, `-AreaPath`,
`-IterationPath`, `-DescField`, `-Html`, `-Field`, `-Parent`, `-Related`, `-BlockedBy`.

`-DescriptionFile` nhận Markdown và chuyển sang HTML: heading, bảng, danh sách, `**đậm**`,
`` `code` ``, link, đường kẻ ngang. File `.html` hoặc cờ `-Html` thì giữ nguyên, không chuyển.

**Field bắt buộc khác nhau theo type.** Thiếu thì API trả `TF401320: Rule Error for field X`.
Dùng `-Field "TênField=Giá trị"` (lặp được) để bù. Đã biết ở `PMIS3-NGUON`:

| Type | Field bắt buộc ngoài Title |
|---|---|
| `Task` | không có — dùng type này cho ticket con là gọn nhất |
| `Ticket` | `Microsoft.VSTS.Common.Severity`, ví dụ `-Field "Microsoft.VSTS.Common.Severity=3 - Medium"` |
| `Product Backlog Item` | `Priority`, `ValueArea`, và một field `Custom.*` — nhiều ràng buộc, tránh dùng |

Tra field bắt buộc của một type:
`{collection}/{project}/_apis/wit/workitemtypes/{type}/fields?api-version=6.0`, lọc `alwaysRequired`.

### Nối quan hệ

`-Parent`, `-Related`, `-BlockedBy` nhận nhiều ID cách nhau bằng dấu phẩy. `-BlockedBy` ánh xạ
sang `System.LinkTypes.Dependency-Reverse` (Predecessor) — Azure DevOps tự sinh chiều ngược lại
(Successor) ở work item kia.

Tạo work item tham chiếu lẫn nhau thì phải **hai lượt**: `create` hết trước để có ID, rồi `link`
để nối. Đây đúng là quy trình `create-then-wire` mà `/wayfinder` yêu cầu.

Output là text thường nên **lọc được**. Danh sách dài thì lọc thay vì đọc hết:

```powershell
.\azdo.ps1 mine -All | Select-String -Pattern '\s(Bug|Ticket)\s'
```

```bash
bash "<thư mục skill>/azdo.sh" mine -All | grep -E '\s(Bug|Ticket)\s'
```

## Phạm vi project — QUAN TRỌNG

**Làm ở repo nào thì chỉ đụng work item của project tương ứng.** Project được suy ra từ
`git remote` của repo hiện tại (`.../{Collection}/{Project}/_git/{Repo}`).

Thứ tự xác định project: cờ `-Project` → biến môi trường **`AZDO_PROJECT`** → `git remote` →
`defaultProject` trong `azdo.config.json`. `AZDO_PROJECT` dùng khi chạy ở **thư mục cha chứa nhiều
repo** (không phải git repo nên không có remote), ví dụ `AZDO_PROJECT=PMIS3-NGUON bash "<thư mục skill>/azdo.sh" mine`.
Khi đặt, nó cũng là "project của repo" cho guard chặn ghi xuyên project bên dưới.

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
| Task | To Do · In Progress | **Done** (type này không có Committed) |
| Ticket | New · Ready · Approved · Designed · In Progress · Accepted | **Done** |
| Issue | New · In Progress · Reopened | **Resolved** |
| Product Backlog Item | New · Approved · In Progress · Designed · Committed | **Done** |

Ý nghĩa: Bug xong → **Committed** = code đã push, chờ kiểm thử; Ticket / Item xong → **Done**.

`finish` tự kiểm tra và **thoát với mã lỗi** khi không được phép:

| Exit | Nghĩa | Phải làm gì |
|---|---|---|
| `2` | State hiện tại ngoài `allowedFrom`, hoặc type không có quy ước | Script đã in sẵn bảng state — **hỏi người dùng chọn**, rồi chạy `state <id> "<tên>" -Yes` |
| `3` | Bug nhưng code chưa push hết | Push xong mới chạy lại. **Không** lách bằng `state` |
| `4` | Item thuộc project khác với repo hiện tại | Mở đúng repo rồi chạy lại. **Không** tự thêm `-CrossProject` |
| `5` | Bước chuyển state đòi thêm field (`TF401320: Rule Error for field X`) | Chạy lại kèm `-Field "X=<giá trị>"`; giá trị mang nghĩa nghiệp vụ thì **hỏi người dùng** |

### Kiểm tra push (`requirePush`, Bug)

- Đang đứng ở **gốc một git repo** → chỉ kiểm tra repo đó.
- Không phải gốc repo (thư mục cha) → kiểm tra **mọi thư mục con cấp 1 là git repo**; tất cả phải đã push.
- Nhánh chưa có upstream = chưa push. Script nêu rõ repo nào chưa push / thiếu upstream.
- Chạy `finish` từ **thư mục con bên trong** một repo sẽ báo "không tìm thấy git repo" — hãy chạy từ gốc
  repo hoặc từ thư mục cha.

### Khóa `activeState`

`azdo.config.json` có thêm khóa `activeState` cho từng type (ví dụ `In Progress`): state "đang làm" mà
PMIS Auto Work đặt cho work item khi bắt đầu task. `azdo.ps1` / `azdo.mjs` bỏ qua khóa này.

## Quy trình

1. **Đọc** — `show <id>`. Không có ID thì `mine -All` để người dùng chọn. `show` chỉ in chữ: mô tả / System Info
   có ảnh nhúng (thiết kế, ảnh chụp đánh dấu kiểu "C1: bỏ dòng này") thì ảnh mang yêu cầu — GET
   `{collection}/_apis/wit/workitems/<id>?api-version=6.0` bằng PAT (cách script dựng request), trích
   `<img src>` trong field HTML, tải từng ảnh bằng PAT vào scratchpad rồi xem. Ảnh lệch với chữ → hỏi người dùng.
2. **Xác nhận** — tóm tắt lại yêu cầu theo cách mình hiểu, hỏi người dùng đúng chưa
   **trước khi** viết code. Mô tả work item thường ngắn và thiếu ngữ cảnh.
3. **Implement** — theo đúng rule của repo (`.claude/rules/`, `CLAUDE.md`, wiki).
4. **Push** — nếu là Bug thì bắt buộc, vì `finish` sẽ chặn khi còn commit chưa push. Nhánh có policy bắt buộc
   pull request (`TF402455: Pushes to this branch are not permitted`) → đẩy lên nhánh riêng
   `git push origin <nhánh>:feature/<id>-<slug>` và báo người dùng tạo PR; tạo/merge PR là việc của người dùng.
   Sau khi người dùng merge: `git pull --ff-only` về nhánh gốc.
5. **Chốt** — theo skill `pmis3-workflow:ado-done`: `finish <id> -Comment "<tổng kết>"` (hoặc
   `state <id> "<State>"` khi người dùng nêu state). Chạy khô trước, `-Yes` sau khi người dùng đồng ý;
   comment và state ghi cùng một lượt.

## Năm ràng buộc bắt buộc

1. **Không ghi khi chưa được đồng ý.** Mọi `comment` / `state` / `finish` / `create` / `link`
   kèm `-Yes` phải được người dùng xác nhận ở lượt trước đó. Không tự resolve, không tự tạo
   work item.
2. **Exit 2 → hỏi, không đoán.** Script in sẵn bảng state kèm số thứ tự; đưa nguyên bảng
   đó cho người dùng chọn. Không tự suy diễn state nào "hợp lý".
3. **Exit 3 → push, không lách.** Không dùng `state` để vượt qua guard push của Bug.
4. **Không đụng PR và pipeline.** Ngoài phạm vi bộ công cụ này.
5. **Không ghi xuyên project.** Repo nào làm việc của project đó. Gặp exit 4 thì báo người dùng
   mở đúng repo, không tự lách bằng `-CrossProject`.

## Lưu ý kỹ thuật

- **Comment là HTML.** Comment ghi vào `System.History` và gửi **nguyên văn** (không qua chuyển Markdown như
  mô tả), còn Azure DevOps hiểu field này là HTML. Chữ dạng `<thẻ>` bị server cắt như thẻ HTML; `<` không
  đóng sẽ làm **mất phần còn lại** của comment. Muốn hiện dấu ngoặc nhọn thì viết `&lt;thẻ&gt;`
  (dấu backtick **không** được chuyển thành code trong comment). Có thể dùng thẻ HTML thật như `<b>`, `<br>`.

- `ConvertFrom-Json` của PowerShell 5.1 **chết** trên payload lớn / có key rỗng của Azure DevOps.
  Script dùng `JavaScriptSerializer` (trả về `Dictionary` lồng nhau, truy cập bằng `['key']`).
- File `azdo.ps1` phải giữ **UTF-8 có BOM**, nếu không PowerShell 5.1 đọc sai tiếng Việt.
  Sửa file xong nhớ ghi lại kèm BOM.
- Body gửi lên Azure DevOps phải là **UTF-8 không BOM**, nếu không API từ chối JSON.
- PAT được đưa vào curl qua **file config tạm (`-K`)**, không qua tham số dòng lệnh, để không
  lộ trong Task Manager / `Get-Process`. File này xóa ngay sau mỗi request.
- Comment ghi qua field `System.History` (`PATCH` với `application/json-patch+json`) —
  cách này chạy trên mọi phiên bản Azure DevOps Server.
- Tạo work item: `POST {project}/_apis/wit/workitems/${type}`. Dấu `$` trước tên type là **bắt
  buộc** trong URL — trong PowerShell phải nối chuỗi bằng nháy đơn, nếu không `$` bị hiểu là biến.
- `Description` của Azure DevOps là **HTML**, không phải Markdown. Script có hàm
  `ConvertTo-AdoHtml` chuyển tập con Markdown hay dùng. `HtmlEncode` biến tiếng Việt thành
  numeric entity (`&#234;`) — vẫn hiển thị đúng, không cần xử lý thêm.
- API **không** trả về `allowedValues` cho những field kiểu chuỗi tự do như `Severity`; muốn biết
  giá trị hợp lệ thì thử hoặc xem trên web UI. `3 - Medium` chạy được với type `Ticket`.

## Kiểm thử

Chạy bộ test của `azdo.mjs` từ gốc repo (dùng glob, dạng thư mục lỗi trên Node 24):

```bash
node --test "plugins/pmis3-workflow/skills/azure-devops/tests/*.test.mjs"
```

Hai biến môi trường **chỉ dành cho test**, không dùng khi làm việc thật: `AZDO_COLLECTION_URL` (trỏ tới
máy chủ giả) và `AZDO_CREDENTIALS_FILES` (danh sách file credentials thay cho đường dẫn mặc định).
Đối chiếu hành vi với `azdo.ps1` trên project `KTAT` ghi ở `tests/parity-ktat.md`.
