---
name: shared-components
description: 'Component và util dùng chung của PMIS3, ƯU TIÊN tái dùng trước khi viết mới: TonKhoDialog, MaterialPickerDialog cho dữ liệu lớn, PagePanel, AuditHistoryCard, ExtAttrForm cho thuộc tính mở rộng, WordEditor soạn thảo và xuất PDF. Kèm pattern chọn nhiều dòng với API bulk và quản lý ảnh qua File API. Đọc TRƯỚC khi định viết helper hay dialog mới.'
---

# Shared Components & Large-Data Patterns

Các component/directive dùng chung và pattern UI cho dữ liệu lớn. **Ưu tiên tái dùng** trước khi viết mới.

## Helper/util tái dùng — đọc wiki utils TRƯỚC khi viết
Mỗi khi định viết một **helper có khả năng tái dùng cao** (format số/ngày/chuỗi, thao tác object/tree/form,
xử lý file, JWT, tọa độ, localStorage...), **BẮT BUỘC đọc `wiki/topics/utils.md` trước**:
- **Đã có** hàm tương đương (kể cả tên khác, ý nghĩa giống) → **import dùng lại**, KHÔNG viết lại
  (vd đừng tự `toLocaleString('vi-VN')` — đã có `formatNumber()` ở `@/app/shared/utils/number.util`).
- **Chưa có** và nhu cầu đủ chung (≥2 nơi dùng, hoặc rõ ràng sẽ tái dùng) → viết thành util trong
  `src/app/shared/utils/` (named function thuần, JSDoc ngắn, thêm `*.spec.ts` nếu có nhánh logic),
  **KHÔNG** nhét logic tiện ích rải rác trong component.
- Sau khi thêm util mới → **cập nhật `wiki/topics/utils.md`** (thêm 1 dòng vào danh mục) để lần sau tra được.

## Component dùng chung sẵn có (`src/app/shared/components/`)

| Component | Selector | Tham số chính | Dùng cho |
|-----------|----------|---------------|----------|
| **TonKhoDialogComponent** | `app-ton-kho-dialog` | `[(visible)]`, `[maVattu]` | Tồn kho theo kho của **1 vật tư** |
| **TonKhoChiTietDialogComponent** | `app-ton-kho-chi-tiet-dialog` | `[(visible)]`, `[maVattuList]` | Chi tiết tồn kho **nhiều vật tư** (row-group theo mã) |
| **MaterialPickerDialogComponent** | `app-material-picker-dialog` | `[(visible)]`, `selectionMode`, `[selected]`, `[excludeCodes]`, `[header]`, `(confirmed)` | Chọn vật tư (lazy, single/multiple) khi dữ liệu lớn |
| **PagePanelComponent** | `app-page-panel` | `[title]`, `[subtitle]`, `(closed)` + slot `[actions]` | Trang chi tiết full-page (overlay fixed). Tự khóa cuộn nền khi mở (tránh 2 thanh cuộn) |
| **AuditHistoryCardComponent** | `app-audit-history-card` | `[title]` (mặc định `'Lịch sử'`), `[data]` (model extends `AuditDTO`) | Card hiển thị audit: người tạo / thời điểm tạo / người sửa / thời điểm sửa |
| **ExtAttrFormComponent** | `app-ext-attr-form` | `objtypeid`, `[objid]`, `[attrgroupid]`, `[readonly]`, `[columns]` + API `isValid()`/`save()`/`reload()`/`getValues()` | Form **thuộc tính mở rộng** động theo Loại thuộc tính × Kiểu dữ liệu |
| **WordEditorComponent** | `app-word-editor` | `[(content)]`, `[(headerHtml)]`, `[(footerHtml)]`, `[fileName]`, `[canvasHeight]`, `[readOnly]`, `[showStatusBar]`, `(exported)` + API `getHtml()`/`setHtml()`/`exportPdf()` | Soạn thảo văn bản kiểu Word trên trang A4, **đầu/chân trang lặp mọi trang** + **xuất PDF** |
| **ImageAttachmentComponent** | `app-image-attachment` | `objTypeId`, `[objId]`, `attachType`, `[maxFiles]`, `[readonly]`, `emptyText`, `unsavedText`, `limitText` | Khối **ảnh đính kèm** của một đối tượng: upload, kéo thả, xem phóng to, tải về, xóa. `maxFiles=1` → một ảnh lớn (mã QR) |

## Card "Lịch sử" (audit) — KHÔNG tự viết lại
Mọi màn hình chi tiết cần hiển thị thông tin tạo/sửa → dùng **`AuditHistoryCardComponent`**, KHÔNG copy markup.
- Model của màn hình phải `extends AuditDTO` (`@/app/models/common.model`) — chứa
  `userCrId/userCrName/userCrDtime/userMdfId/userMdfName/userMdfDtime`. Backend trả các cột này ở API detail.
- Dùng: `<app-audit-history-card [data]="record()" />` (đổi tiêu đề: `title="..."`).
- Card hiển thị tên (ưu tiên `userCrName` → fallback `userCrId`) và ngày `dd/MM/yyyy HH:mm`, thiếu thì `—`.

## Thuộc tính mở rộng trong form nghiệp vụ — KHÔNG tự render lại
Form nào cần hiện thuộc tính mở rộng của một đối tượng → dùng **`ExtAttrFormComponent`**, KHÔNG tự gọi
API định nghĩa rồi tự dựng control.
- Component tự nạp định nghĩa + giá trị + danh sách chọn qua **1 request** (`GET /attribute-data`) và tự
  chọn element theo `atttypeid` × `coldatatypeid`: `INPUT`+`STR`≤255 → input, `STR` 0/dài → textarea,
  `NUM` → `p-inputnumber` (căn phải), `DATE` → `p-datepicker`, `BOOL` → `p-checkbox`,
  `CBBOX` → `p-select [editable]`, `CBLST` → `p-select`, `COUNT` → chỉ đọc, `VIEW` → nhãn tĩnh.
- Validator tự suy ra từ khai báo: `collallownull=false` → required, `collength` → maxLength,
  `colprecision/colscale` → chặn tràn số DECIMAL.
- **KHÔNG tự lưu.** Form cha giữ `#ref` rồi gọi `save()` sau khi lưu bản ghi chính; tạo mới thì
  `save(idVuaTao)`. Chặn submit bằng `isValid()` + `showErrors()`.
- Bỏ trống `attrgroupid` = render mọi nhóm đã gán cho đối tượng; truyền vào = chỉ nhóm đó.
- `dataquerylst`/`dataqueryone` do admin nhập được backend chạy qua `AttributeQueryService`
  (chỉ SELECT, biến `@`/`@@`/`@MaTT` truyền bằng tham số JDBC). Ví dụ dùng: route `apps/thuoc-tinh-mo-rong`.

## Soạn thảo văn bản kiểu Word — KHÔNG tự dựng editor
Màn hình nào cần người dùng nhập văn bản có định dạng (biên bản, báo cáo, thông báo…) và/hoặc
xuất PDF → dùng **`WordEditorComponent`**, KHÔNG cài thêm thư viện editor.
- Dựng trên `contenteditable` + `execCommand`, HTML sinh ra là **HTML thuần có style inline** →
  lưu thẳng vào DB, hiển thị lại ở nơi khác hay xuất file đều giữ nguyên định dạng.
- Vùng soạn thảo là **trang A4 thật** (210×297mm, lề 20mm).
- **Xuất file do BACKEND sinh, KHÔNG dựng file ở frontend.** Component gọi
  `DocumentExportService` (`services/common/document-export.service.ts`) →
  `POST /conversion/export/word|pdf` (có ở mọi microservice qua `pmis3-file-starter`), rồi tải
  Blob về bằng `downloadBlob()`. Word do Apache POI dựng; PDF sinh từ **chính file Word đó** qua
  Gotenberg nên hai file luôn khớp, và chữ trong PDF là chữ thật (bôi đen / tìm kiếm được).
- Có: phông/cỡ chữ, màu chữ & màu nền, canh lề, danh sách chấm/số, thụt lề, **chèn bảng**
  (Tab nhảy ô, Tab ở ô cuối thêm dòng), chèn ảnh (base64), liên kết, thu phóng.
- **Đầu trang / chân trang lặp lại ở MỌI trang** qua `[(headerHtml)]` / `[(footerHtml)]`: bấm thẳng
  vào dải mờ trên/dưới tờ giấy để sửa, sửa ở trang nào cũng áp dụng cho cả tài liệu. Trong dải dùng
  `{trang}` / `{tong}` để chèn số trang / tổng số trang.
- Phân trang thật: sau mỗi lần sửa, component đo lại và chèn khối đệm vô hình
  (`[data-we-spacer]`) tại điểm ngắt trang để chữ không đè lên dải đầu/chân trang. Khối đệm
  KHÔNG có trong `getHtml()` / `[(content)]`. Ngoại lệ đã biết: một khối cao hơn cả trang
  (ảnh lớn, bảng rất dài) không cắt được nên vẫn tràn qua ranh giới trang.
- Lưu cùng bản ghi chính: giữ `#ref` rồi gọi `getHtml()` lúc submit; nạp dữ liệu cũ bằng
  `[content]` hoặc `setHtml()`. Chỉ xem: `[readOnly]="true"` (ẩn thanh công cụ).
- Thuật toán phân trang có test chạy trên Chrome thật: `word-editor.spec.ts`. Sửa logic đo đạc
  thì chạy lại `ng test --include="**/word-editor.spec.ts"`.

## Pattern dialog dùng chung (signals, Angular 20)
- `visible = model(false)` (two-way), tham số dữ liệu là `input(...)`.
- Tự nạp dữ liệu bằng `effect()`: khi `visible() && <input>` có giá trị → `untracked(() => this.load(...))`.
- Subscription dùng `takeUntilDestroyed(this.destroyRef)` (không cần `destroy$`).
- **Bind từ component cha bằng signal**: KHÔNG dùng `[(visible)]="signal"` (assign vào signal sẽ lỗi).
  Dùng `[visible]="v()" (visibleChange)="v.set($event)"`.
- p-dialog bên trong: `[visible]="visible()" (visibleChange)="visible.set($event)"`.

## Dữ liệu lớn → KHÔNG dùng `p-select`/`p-multiselect`
Khi danh sách nguồn rất lớn (vd toàn bộ vật tư), KHÔNG nạp hết vào `p-select`/`p-multiselect`.
Dùng **`MaterialPickerDialogComponent`**: lazy phân trang + tìm kiếm server-side, chọn theo **mã**
(giữ lựa chọn khi chuyển trang), hiển thị mã đã chọn dạng chip + nút "Chọn" mở picker.

## Chọn nhiều dòng + thanh hành động (list page)
- `p-table` + `dataKey` + `[selection]`/`(selectionChange)` → signal `selectedItems`.
- Cột đầu: `<p-tableHeaderCheckbox>` (header) và `<p-tableCheckbox [value]="item">` (body, bọc `$event.stopPropagation()`).
- Thanh hành động **chỉ hiện khi `selectedItems().length > 0`**: "Đã chọn N", các action (gate `canUpdate()`/`canDelete()`), "Bỏ chọn".
- Reset selection trong `loadData()` để tránh chọn lẫn giữa các trang (lazy).
- **Thao tác hàng loạt gọi API bulk 1 lần** (vd `bulkUpdateStatus`, `bulkDelete`), KHÔNG `forkJoin` lặp.

## Ô số liệu bấm được → mở dialog
Cột số (tồn kho, số lượng...) nên là `<button>` mở dialog chi tiết, kèm `$event.stopPropagation()`
nếu hàng có `(dblclick)`. Ví dụ: cột "Tồn kho" ở list mở `TonKhoDialogComponent`; số lượng trong
"Tồn kho theo kho" mở chi tiết phân rã kho con/lô.

## Ảnh đính kèm — dùng `ImageAttachmentComponent`, KHÔNG tự dựng lại
Mọi khối ảnh gắn với một bản ghi (ảnh thiết bị, ảnh vật tư, ảnh mã QR…) → dùng **`app-image-attachment`**.
Component tự lo trọn vòng đời qua File API dùng chung: `GET /file/list` (liệt kê), `FileService.upload`,
`deleteFile`, `triggerDownload`.

```html
<app-image-attachment [objTypeId]="'A'" [objId]="assetid()" attachType="QR" [maxFiles]="1"
  [readonly]="readonly()" limitText="Mỗi thiết bị chỉ có một ảnh QR." />
<app-image-attachment [objTypeId]="'A'" [objId]="assetid()" attachType="AI" [readonly]="readonly()" />
```

- `objId` rỗng (bản ghi chưa lưu) → hiện `unsavedText`, khóa tải lên. Backend (`validateObjAttach`)
  vốn từ chối upload khi bản ghi chưa tồn tại.
- `maxFiles` vượt → **từ chối cả lô** và báo `limitText` qua `ConfirmDialogService` (không tự gọi toast).
- Nhận `IMAGE_EXTENSIONS` (`jpg, jpeg, png, bmp, webp, svg`). Chỉ chính người tải lên xóa được (`canDelete`).
- Cần: đăng ký `file/list` GET (+ `file/uploadfile`, `file/download`, `file/deleteFile`) vào
  `Q_FUNCTION_ENDPOINT` cho chức năng; cặp (`objTypeId`, `attachType`) có trong `F_FILE_OBJTYPE_ATTACH`.
- Danh sách tệp **không phải ảnh** của một đối tượng → `FileService.list(objTypeId, objId, attachType)`
  (trả `FFileItem[]` có `canDelete`), KHÔNG viết endpoint liệt kê riêng cho từng phân hệ.

### Hiển thị ảnh từ server — bắt buộc bọc lại blob
- Tải bằng `FileService.download(url)` rồi `URL.createObjectURL(toImageBlob(blob, fileType))`
  (`shared/utils/image-blob.util`). Backend trả `octet-stream` cho svg/webp/bmp; không bọc thì **svg hiện ô trống**.
- **SVG có thể chứa script** → CHỈ hiển thị qua `<img>`/`p-image`. KHÔNG iframe, KHÔNG mở tab mới.
  Không gán `getDownloadUrl()` thẳng vào `<img src>` (svg không hiện).
- Thu hồi object URL khi gỡ ảnh / hủy component.
- Xem toàn màn hình: `<p-image [preview]="true">` + import **`GlobalImageOverrideDirective`** để có nút Tải xuống.
- Vùng kéo thả: khi bản ghi đã lưu, **luôn `preventDefault` ở `dragover`/`drop` kể cả khi đã đủ ảnh** —
  không chặn thì thả tệp vào là trình duyệt mở tệp và rời khỏi trang.

## Backend đi kèm (tham khảo nhanh)
- Liệt kê tệp theo đối tượng: `GET /file/list?objTypeId&objId&attachType` của `pmis3-file-starter` (kiểm quyền đọc đơn vị). Cần kiểm sâu hơn (vd quyền khu vực) → khai bean `FileObjectReadGuard` (`supports(objTypeId)`, `checkRead(orgid, objId)`) trong service chủ quản.
- Composite key (`@EmbeddedId`) → map thủ công trong service (không dựa MapperUtil cho id nhúng).
- Entity thiếu `@Id` → native SQL qua `EntityManager`, không tạo repository/entity.
- Mệnh đề `IN (...)` → chia lô ≤ **1000** (SQL Server tối đa 2100 tham số).
- Export Excel: Apache POI `SXSSFWorkbook`. Import Excel: `WorkbookFactory` + **dò dòng tiêu đề** theo nhãn (file có/không có dòng thông tin đầu).
