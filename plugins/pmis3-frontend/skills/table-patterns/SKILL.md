---
name: table-patterns
description: 'Quy tắc BẮT BUỘC cho p-table và AG Grid trong PMIS3: không tạo cột Thao tác riêng mà dùng hover pill, độ rộng cột action, paginatorDropdownAppendTo, căn phải và định dạng số phân tách hàng nghìn, theme AG Grid qua Theming API. Đọc khi tạo hoặc sửa bất kỳ bảng dữ liệu nào.'
---

# Table Patterns

Quy tắc bắt buộc cho p-table trong toàn bộ project.

## Row Actions on Hover

KHÔNG dùng cột "Thao tác" riêng. Thay bằng hover pill ẩn trong cột cuối:

```html
<tr class="group cursor-pointer" (dblclick)="openEdit(item)">
  ...
  <td class="relative overflow-hidden text-center" style="width: Npx">
    <!-- Nội dung hiển thị thường (vd: p-tag trạng thái) -->
    <p-tag ... />
    <!-- Hover actions -->
    @if (canUpdate() || canDelete()) {
      <div class="absolute inset-y-0 right-0 flex items-center pr-2 opacity-0 group-hover:opacity-100 transition-all duration-200">
        <div class="flex items-center gap-0.5 bg-white rounded-full shadow-md border border-gray-200 px-1">
          @if (canUpdate()) {
            <p-button icon="pi pi-pencil" [rounded]="true" [text]="true" size="small" severity="info"
              (onClick)="openEdit(item); $event.stopPropagation()" pTooltip="Sửa" tooltipPosition="top" />
          }
          @if (canDelete()) {
            <p-button icon="pi pi-trash" [rounded]="true" [text]="true" size="small" severity="danger"
              (onClick)="delete(item); $event.stopPropagation()" pTooltip="Xóa" tooltipPosition="top" />
          }
        </div>
      </div>
    }
  </td>
</tr>
```

**Quy tắc quan trọng**:
- `relative overflow-hidden` đặt trên `<td>`, KHÔNG đặt trên `<tr>` (PrimeNG không đảm bảo `<tr>` là containing block)
- `$event.stopPropagation()` bắt buộc trên mỗi button
- Double-click row để edit: `(dblclick)="openEdit(item)"` trên `<tr>`

**Width guide cho cột action** (phải đủ rộng để pill không bị clip):
| Số buttons | Width tối thiểu |
|---|---|
| 1 | 60px |
| 2 | 100px |
| 3 | 130px |
| 4 | 160px |
| 5 | 200px |

`<th>` header phải có cùng width với `<td>`.

## Paginator

Mọi `<p-table>` có `[rowsPerPageOptions]` đều phải thêm:
```html
[paginatorDropdownAppendTo]="'body'"
```
Tránh dropdown bị clip bởi overflow container.

## p-select / p-dropdown trong Dialog

Luôn dùng `appendTo="body"`:
```html
<p-select appendTo="body" ... />
<p-dropdown appendTo="body" ... />
<p-multiselect appendTo="body" ... />
```

## Căn lề header (`<th>`)

PrimeNG đặt `text-align: start` cho `.p-datatable-thead > tr > th` (đặc hiệu hơn class Tailwind
→ **nuốt mất** `class="text-right"`/`text-center` đặt trên `<th>`). `styles.css` đã có global fix cho
`th.text-right` / `th.text-center` / `th.text-left` thắng lại → cứ dùng **class** trên `<th>` như bình
thường (KHÔNG cần inline `style="text-align:..."`). Body `<td>` không bị theme override nên class chạy sẵn.

## Định dạng số trong bảng

Dữ liệu **số** trong bảng (số lượng, tiền, khối lượng...) bắt buộc:
- **Căn phải** (`text-right`) — cả `<th>` lẫn `<td>` (header thắng nhờ global fix ở trên).
- Hiển thị dạng phân tách hàng nghìn: `xx xxx,yy` (dấu cách ngăn hàng nghìn, dấu phẩy ngăn phần thập phân).
- **Số chữ số thập phân**: dùng **1, 2, 4 hoặc 5** tùy độ chính xác cần thiết.
  **TRÁNH dùng 3** chữ số thập phân — dễ nhầm với nhóm phân tách hàng nghìn.

```html
<td class="text-right">{{ item.soLuong | number:'1.2-2' }}</td>
```
- `'1.2-2'` = luôn 2 chữ số thập phân; đổi thành `'1.1-1'`, `'1.4-4'`, `'1.5-5'` theo nhu cầu.
- Ô số bấm được (mở dialog chi tiết) vẫn căn phải và giữ nguyên định dạng trên.
- **Locale đã cấu hình sẵn** ở `core/providers/locale.provider.ts` (`LOCALE_ID='vi'`, ghi đè dấu
  nhóm hàng nghìn thành dấu cách). Nên `| number` và `iAppNumber` **tự** ra `19 992,5` — KHÔNG tự
  `toLocaleString('vi-VN')` (ra `19.992,5`, sai chuẩn dự án).
- Cần format số **trong code TS** (không qua pipe) → dùng hàm dùng chung `formatNumber()` ở
  `@/app/shared/utils/number.util` (mặc định `1.0-2`; có `formatInteger()`), KHÔNG viết lại
  `toLocaleString`. Ví dụ expose cho template: `protected readonly formatNumber = formatNumber;`.

## Chọn nhiều dòng, thao tác hàng loạt, ô số bấm được

Cho bảng có checkbox chọn nhiều + thanh hành động (chỉ hiện khi có dòng được chọn), gọi **API bulk**
thay vì lặp, và ô số liệu bấm-được để mở dialog chi tiết → xem **`shared-components.md`**.

Khi cần ô chọn từ danh sách rất lớn (không dùng `p-select`/`p-multiselect`), dùng
`MaterialPickerDialogComponent` (lazy) — cũng mô tả trong **`shared-components.md`**.

## AG Grid — bảng nhập liệu Excel-like (`ag-grid-angular`)

Dùng cho bảng **nhập số hàng loạt** (kế hoạch, sản lượng theo tháng/giờ...). Module đăng ký sẵn ở
`main.ts` (`AllCommunityModule`). Quy tắc bắt buộc:

- **Theme đi qua Theming API, KHÔNG qua file CSS.** Từ ag-grid v33, grid tự inject style; file
  `ag-grid-community/styles/ag-*.css` và class `.ag-theme-alpine` KHÔNG còn tác dụng (nạp kèm còn gây
  lỗi #239). Mọi grid bind theme dùng chung:
  ```html
  <ag-grid-angular [theme]="agGridTheme" ... />
  ```
  ```ts
  protected readonly agGridTheme = AG_GRID_THEME; // @/app/shared/ag-grid/ag-grid-theme
  ```
  Đổi cỡ chữ/màu/spacing → sửa `withParams({...})` trong `ag-grid-theme.ts` (vd `fontSize`,
  `dataFontSize`), KHÔNG đặt biến `--ag-*` trong CSS: theme khai báo biến ngay trên wrapper của grid
  nên biến đặt ở thẻ cha bị thua.

- **Ô số căn phải — cả khi hiển thị, khi đang nhập, LẪN tiêu đề cột.** Cột số đặt `type: 'numericColumn'`
  **và** thêm `cellClass: 'kh-num-cell'` + `headerClass: 'kh-num-header'`, rồi ép căn phải bằng CSS scoped:
  ```scss
  ::ng-deep .kh-num-cell { justify-content: flex-end; text-align: right; }
  ::ng-deep .kh-num-cell input.ag-input-field-input { text-align: right; }   // input lúc edit
  ::ng-deep .kh-num-header .ag-header-cell-label { justify-content: flex-end; } // tiêu đề cột
  ```
  `numericColumn` KHÔNG đủ: nó không căn phải **header** và không căn phải **ô editor** khi gõ.
- **Có viền lưới (kẻ dọc) cho từng ô** để dễ nhìn. Alpine mặc định chỉ kẻ ngang; biến `--ag-*` hay không
  ăn → đặt `border-right` **trực tiếp** cho chắc:
  ```scss
  ::ng-deep .ag-root-wrapper { border: 1px solid #cbd5e1; }             // viền quanh bảng
  ::ng-deep .ag-header-cell,
  ::ng-deep .ag-cell { border-right: 1px solid #dfe3e8; }               // kẻ dọc từng cell + header
  ```
- **Hiển thị số** dùng `valueFormatter` gọi `formatNumber()` (`@/app/shared/utils/number.util`), KHÔNG tự
  `toLocaleString`. `valueParser` trả `null` khi rỗng, chấp nhận dấu phẩy thập phân (`replace(',', '.')`).
- **Bind dữ liệu** `[rowData]="grid.rows"` từ signal; ag-grid sửa **tại chỗ** object dòng → đọc lại signal khi
  lưu là có giá trị mới (không cần GridApi). Nhiều bảng nhỏ: `[domLayout]="'autoHeight'"`.
- **Copy/paste kiểu Excel**: bắt `(cellKeyDown)` cho Ctrl+C/V, đọc/ghi TSV qua `navigator.clipboard`, map cột
  theo thứ tự field cố định (tham khảo `pages/sxd/ke-hoach`).
