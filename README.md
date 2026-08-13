# pmis3-skills

Bộ quy ước và skill dùng chung cho toàn bộ hệ sinh thái **PMIS3** — `PMIS3-NGUON`, `PMIS3-LUOI`
và các ứng dụng vệ tinh. Cài một lần, dùng được ở **mọi repo** (mọi microservice frontend lẫn backend).

## Cài đặt

Gõ trong Claude Code (không cần clone repo, không cần token — repo public):

```
/plugin marketplace add PhamVanDiep/pmis3-skills
```

Rồi cài plugin theo việc bạn làm:

| Bạn làm | Cài |
|---|---|
| Frontend Angular | `/plugin install pmis3-frontend@pmis3-skills`<br>`/plugin install pmis3-workflow@pmis3-skills` |
| Backend Spring Boot | `/plugin install pmis3-backend@pmis3-skills`<br>`/plugin install pmis3-workflow@pmis3-skills` |
| Cả hai (full-stack) | cài cả ba |

Khởi động lại Claude Code sau khi cài.

> Không cài plugin không dùng tới: mô tả của **mọi** skill đều được nạp vào context ở mọi phiên,
> nên dev backend cài thêm `pmis3-frontend` là trả giá context cho 17 skill Angular không bao giờ dùng.

## Cập nhật

**Claude Code KHÔNG tự cập nhật marketplace bên thứ ba.** Đây là hành vi đã đo được, không phải suy đoán:
marketplace của Anthropic được làm mới mỗi lần khởi động, còn marketplace GitHub bên ngoài nằm im
(một marketplace bên ngoài trên máy thật đã tụt **18 commit sau 24 ngày**).

Vì vậy plugin `pmis3-workflow` mang sẵn một **SessionStart hook tự kiểm tra**: tối đa 1 lần/12 giờ,
nó `git fetch` marketplace và báo khi có bản mới. Hook chỉ **thông báo**, không tự update — vì
`claude plugin update` cần restart mới có hiệu lực, tự chạy giữa phiên chỉ tạo trạng thái nửa vời.

Khi được báo (hoặc bất cứ lúc nào muốn):

```
claude plugin marketplace update pmis3-skills
claude plugin update pmis3-frontend      # và pmis3-backend / pmis3-workflow nếu có cài
```

Rồi khởi động lại Claude Code.

Mọi nhánh lỗi của hook đều thoát im lặng: không có `git`, mất mạng, chưa cài marketplace — hook
không bao giờ làm phiền hay chặn phiên làm việc.

## Nội dung

### `pmis3-frontend` — 17 skill + 1 command

Quy ước **bắt buộc** (đọc trước khi viết code):

| Skill | Nội dung |
|---|---|
| `angular-patterns` | prefix `tw-` chỉ cho padding, signals thay BehaviorSubject, BaseComponent, không tự gọi toast, phân trang, path alias |
| `primeng-rules` | TabsModule, `p-treeTableToggler`, `appendTo="body"` trong dialog |
| `ui-conventions` | page wrapper, không dùng `h-full`, tiêu đề, định dạng ngày, màu sidebar |
| `table-patterns` | hover pill thay cột Thao tác, định dạng số, paginator, AG Grid |
| `shared-components` | component/util dùng chung — ưu tiên tái dùng trước khi viết mới |

Theo chủ đề: `coding-standards`, `component-development`, `primeng-patterns`, `api-services`,
`granted-catalog`, `data-table-patterns`, `forms-dialogs`, `routing`, `styling`,
`state-management`, `permissions`, `fe-spec-implement`.

Command: `/fe-spec`.

### `pmis3-backend` — 12 skill

`architecture`, `auth`, `controller`, `service`, `data`, `notification`, `config`, `pitfalls`,
`crud`, `add-api`, `frontend-spec`, `commands`.

### `pmis3-workflow` — 5 skill

`azure-devops` (đọc/cập nhật work item Azure DevOps on-prem EVN bằng Windows auth, không cần PAT),
`feature-doc`, `feature-doc-update`, `design-to-feature`, `design-to-feature-sxd`.

## Gọi skill

Skill của plugin có tiền tố là tên plugin:

```
/pmis3-backend:crud
/pmis3-frontend:fe-spec-implement
/pmis3-workflow:azure-devops
```

Phần lớn skill **tự kích hoạt** theo ngữ cảnh nhờ trường `description`, không cần gõ tên.

## Đóng góp / sửa quy ước

1. Sửa `plugins/<plugin>/skills/<skill>/SKILL.md`
2. Bump `version` ở **cả hai** nơi: `plugins/<plugin>/.claude-plugin/plugin.json` và mục tương ứng
   trong `.claude-plugin/marketplace.json` — lệch nhau sẽ bị `claude plugin validate` báo lỗi
3. `claude plugin validate .` để kiểm tra manifest trước khi push
4. Push lên `main`; hook sẽ báo cho cả team trong vòng 12 giờ

`SKILL.md` bắt buộc có frontmatter `name` + `description`. Thiếu `name` thì Claude Code **im lặng bỏ
qua** skill đó — đây chính là lý do 10 skill backend trước đây không bao giờ tự chạy.

Viết `description` theo hướng **khi nào dùng**, không phải mô tả chủ đề. Đây là thứ duy nhất Claude
đọc để quyết định có nạp skill hay không.

## Quan hệ với `.claude/` trong từng repo

Các repo hiện tại vẫn giữ `.claude/` riêng — bộ plugin này **chưa thay thế** chúng, nên nội dung
đang trùng lặp. Việc dọn `.claude/` trùng trong từng repo là bước riêng, làm sau khi bộ plugin
đã chạy ổn định.
