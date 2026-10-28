---
name: security-audit
description: 'Rà soát an toàn thông tin (ATTT) mã nguồn PMIS3 backend Spring Boot / frontend Angular theo 04 nhóm lỗi bắt buộc: OWASP Top 10, lộ bí mật/PII, xác thực–phân quyền (IDOR theo đơn vị, whitelist, Q_FUNCTION_ENDPOINT), SQL Injection/XSS. Dùng khi người dùng yêu cầu rà soát bảo mật / ATTT / security review cho diff PR, một module trước phát hành, hoặc theo yêu cầu bộ phận ATTT. Chỉ báo cáo, không tự sửa.'
---

# Skill: Rà soát an toàn thông tin (security-audit)

Rà soát **chỉ đọc mã**, xuất báo cáo phát hiện có **đường dẫn tấn công**, chờ lập trình viên xác minh và quyết định
sửa. Phạm vi càng hẹp, báo nhầm càng ít: ưu tiên diff của PR hoặc một module, không quét cả hệ thống trong một lần.

Tài liệu đi kèm (đọc khi tới bước tương ứng):

| Tệp | Nội dung |
|---|---|
| `references/checklist-chung.md` | Bảng 04 nhóm lỗi + câu hỏi xác minh từng hạng mục — dùng cho mọi phạm vi |
| `references/pmis3-backend.md` | Cơ chế bảo mật thật của `pmis3-security-starter` và các điểm hay hở ở backend PMIS3 |
| `references/pmis3-frontend.md` | Cookie/CSRF, quyền chỉ ở giao diện, XSS trong Angular/PrimeNG/AG Grid, cấu hình lúc chạy |
| `scripts/quet-bi-mat.sh` | Sàng lọc bí mật viết cứng, che giá trị khi in, bỏ qua `.env*` |

## Ràng buộc (guardrail)

- **Không sửa mã, không commit.** Đề xuất khắc phục nằm trong báo cáo; sửa khi người dùng chọn phát hiện cần sửa.
- **Không khai thác thử.** Backend chạy local nhưng CSDL là DB dev dùng chung: không gọi API ghi dữ liệu, không gửi
  payload tấn công để "chứng minh". Xác minh bằng đọc mã và unit test cục bộ.
- **Báo cáo là tài liệu hạn chế.** Trả trong phiên làm việc. Chỉ ghi ra tệp, đăng comment Azure DevOps, Confluence,
  PR hay Artifact khi người dùng yêu cầu rõ — lỗ hổng chưa vá là dữ liệu mật.
- **Đọc bí mật ở mức tối thiểu**: không mở `.env`, `e2e/.env.local`, `*.pem`, `*.key`, `azdo.credentials.json`.
  Kiểm tệp bí mật có bị commit bằng `git ls-files` / `git log --all -- <đường dẫn>`, không bằng cách đọc nội dung.
- **Bí mật thật đã lên remote**: báo ngay đầu báo cáo, mức Nghiêm trọng — **xoay vòng (rotate) trong 08 giờ trước**,
  xóa khỏi lịch sử Git sau.

## Quy trình

### Bước 1 — Chốt phạm vi và liệt kê điểm vào

1. Phạm vi mặc định là diff của nhánh hiện tại: `git diff --name-only origin/dev...HEAD` (repo không có `dev` thì
   `origin/main`). Người dùng chỉ định module/thư mục thì theo đó.
2. Loại dự án: có `pom.xml` → backend, có `angular.json` → frontend. Workspace nhiều repo thì rà từng repo.
3. Liệt kê **điểm vào** trong phạm vi — đây là danh sách để bước 3 phủ hết:
   - Backend: mọi `@RestController` (method + path), `@KafkaListener`, `@Scheduled`, nhận tệp (`MultipartFile`,
     import Excel), lời gọi ra ngoài (`RestTemplate`, `WebClient`, `FeignClient`).
   - Frontend: route mới, interceptor, chỗ render HTML/URL từ dữ liệu, chỗ đọc query param.

Xong khi: có danh sách điểm vào kèm `tệp:dòng`.

### Bước 2 — Sàng lọc bí mật

```bash
bash <thư-mục-skill>/scripts/quet-bi-mat.sh --diff     # phạm vi diff (BASE_BRANCH=origin/main nếu cần)
bash <thư-mục-skill>/scripts/quet-bi-mat.sh src/main   # một thư mục
```

Mỗi dòng trúng là **ứng viên**, chưa phải phát hiện: đối chiếu câu hỏi xác minh nhóm (ii) trong `checklist-chung.md`.

### Bước 3 — Rà 04 nhóm lỗi

Đọc `references/checklist-chung.md` rồi tệp PMIS3 theo loại dự án. Với **mỗi điểm vào** ở bước 1, đi theo luồng dữ
liệu từ đầu vào tới CSDL / HTML / lời gọi ra ngoài — không dừng ở tìm từ khóa.

Thứ tự ưu tiên: nhóm (iii) xác thực–phân quyền trước (ít báo nhầm nhất, rà thủ công dễ sót nhất vì phải đối chiếu
controller ↔ service ↔ repository ↔ `Q_FUNCTION_ENDPOINT`), rồi (iv), (ii), (i).

Xong khi: **mọi hạng mục** của 04 nhóm có một kết luận — *có phát hiện* / *sạch* / *không áp dụng* — kèm một câu lý
do. Hạng mục không có kết luận là chưa rà.

### Bước 4 — Lọc báo nhầm

Giữ một phát hiện khi trả lời được cả ba:

1. **Đường dẫn tấn công**: ai (chưa đăng nhập / người dùng đơn vị khác / người chỉ có quyền xem) gửi gì, tới đâu,
   được gì. Không mô tả được thì xếp *cần điều tra* hoặc bỏ.
2. **Lớp chặn**: đã có lớp nào chặn chưa (Spring Security, `FunctionAuthorizedInterceptor`, kiểm đơn vị trong
   service, sanitizer của Angular)? Đối chiếu bằng mã, không giả định.
3. **Độ tin cậy**: Cao (đã truy hết luồng) / Trung bình (còn một mắt xích chưa thấy) / Thấp (nghi ngờ).

Dữ liệu giả trong thư mục test, giá trị `${ENV}` trong `application.yml`, cấu hình Firebase web (khóa công khai
theo thiết kế) là báo nhầm điển hình — ghi vào danh mục báo nhầm kèm lý do.

### Bước 5 — Báo cáo

Dùng mẫu dưới. Mức độ: **Nghiêm trọng** (khai thác không cần đăng nhập, hoặc lộ bí mật thật) · **Cao** (người đã
đăng nhập vượt quyền chức năng/đơn vị, SQLi, XSS lưu trữ) · **Trung bình** (cần điều kiện kèm theo, lộ thông tin nội
bộ) · **Thấp** (phòng thủ chiều sâu).

````markdown
## Báo cáo rà soát ATTT — <phạm vi>
Ngày: <dd/MM/yyyy> · Repo/nhánh: <...> · Số điểm vào đã rà: <n>

### Tổng hợp
| Nhóm | Nghiêm trọng | Cao | Trung bình | Thấp | Cần điều tra |
|---|---|---|---|---|---|
| (i) OWASP Top 10 | | | | | |
| (ii) Lộ bí mật / PII | | | | | |
| (iii) Xác thực – phân quyền | | | | | |
| (iv) SQL Injection / XSS | | | | | |

### Phát hiện (xếp theo mức độ)
**[CAO] (iii) <tên ngắn>** — độ tin cậy: Cao
- Vị trí: `ThietBiService.java:142` ← `ThietBiController.java:88` `PUT /thiet-bi/cap-nhat`
- Đường dẫn tấn công: người dùng đơn vị A gửi `orgid` = A và `id` bản ghi của đơn vị B → interceptor chỉ kiểm A,
  service `findById(id)` rồi lưu → sửa được thiết bị đơn vị B.
- Lớp chặn đã kiểm: interceptor (chỉ theo header), service (không so `orgid` bản ghi).
- Vi phạm: OWASP A01 · BE-05
- Đề xuất: <đoạn mã minh họa ngắn>

### Kết luận từng hạng mục
<bảng hạng mục → có phát hiện / sạch / không áp dụng + lý do>

### Danh mục báo nhầm
| Ứng viên | Vị trí | Lý do loại |
|---|---|---|
````

Kết thúc bằng câu hỏi: người dùng muốn sửa những phát hiện nào. Khi sửa, mỗi phát hiện được sửa đi kèm test tái hiện
đỏ trước rồi xanh (skill `pmis3-backend:testing` / `pmis3-frontend:testing`).

## Definition of Done

- [ ] Mọi điểm vào ở bước 1 đã được đi theo luồng dữ liệu
- [ ] Mọi hạng mục của 04 nhóm có kết luận kèm lý do
- [ ] Mỗi phát hiện có vị trí `tệp:dòng`, đường dẫn tấn công, lớp chặn đã kiểm, mức độ, độ tin cậy, đề xuất
- [ ] Có danh mục báo nhầm kèm lý do
- [ ] Không có thay đổi mã, không có báo cáo đăng ra ngoài phiên khi chưa được yêu cầu
