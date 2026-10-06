---
name: primeng-rules
description: 'Quy tắc BẮT BUỘC khi dùng PrimeNG trong PMIS3: dùng TabsModule thay vì TabView, p-treeTableToggler viết hoa chữ T, luôn appendTo="body" cho p-select/p-dropdown/p-multiselect trong dialog, nút tải xuống cho p-image, bẫy của p-galleria (thumbnail kẹt, nút ‹ › bị che, style mask). Đọc khi đụng tới bất kỳ component PrimeNG nào.'
---

# PrimeNG Rules

Quy tắc bắt buộc khi dùng PrimeNG components.

## Tabs

Dùng `TabsModule` từ `primeng/tabs`, KHÔNG dùng `TabView`:
```ts
import { TabsModule } from 'primeng/tabs';
```
```html
<p-tabs [value]="activeTab()">
  <p-tablist>
    <p-tab value="0">Tab 1</p-tab>
  </p-tablist>
  <p-tabpanels>
    <p-tabpanel value="0">...</p-tabpanel>
  </p-tabpanels>
</p-tabs>
```

## TreeTable Toggler

Dùng `<p-treeTableToggler>` với chữ T hoa:
```html
<p-treeTableToggler [rowNode]="rowNode" />
```
KHÔNG dùng `<p-treetableToggler>` hay `<p-tree-table-toggler>`.

## p-select / p-dropdown / p-multiselect trong Dialog

Luôn thêm `appendTo="body"` để tránh bị clip bởi overflow của dialog:
```html
<p-select appendTo="body" ... />
<p-dropdown appendTo="body" ... />
<p-multiselect appendTo="body" ... />
```

## p-image (preview fullscreen)

- Xem ảnh fullscreen + zoom/xoay: `<p-image [preview]="true" ... />`.
- PrimeNG 20 **không có slot** thêm nút lên toolbar preview, và mask được append ra `document.body`
  → không tìm được bằng MutationObserver trên host. Để có nút **Tải xuống**, import
  `GlobalImageOverrideDirective` (`@/app/shared/directives/global-image-override.directive`) vào
  component dùng `<p-image>` (directive standalone phải nằm trong `imports`).
- CSS scoped (`:host ::ng-deep`) KHÔNG tới được mask trong `body` → set style icon **inline** trong directive.

## p-galleria (PrimeNG 21)

Đã dùng sẵn trong `ImageAttachmentComponent` chế độ `[gallery]` — cần gallery ảnh thì tái dùng component đó
(skill `shared-components`). Tự dựng `p-galleria` thì xử lý đủ các bẫy sau:

- **Dựng lại khi số phần tử đổi.** `value.length < numVisible` → galleria tự hạ số ô thumbnail theo số phần tử
  lúc khởi tạo, và ghi độ rộng ô (`flex: 1 0 N%`) vào thẻ `<style>` **một lần duy nhất**. Dữ liệu về dần (ảnh
  tải lần lượt, thêm/xóa ảnh) → ô kẹt ở cỡ cũ, phần tử sau bị che, nút ‹ › bị khóa. Bọc trong khối khóa theo
  số phần tử:
  ```html
  @for (n of [items().length]; track n) {
    <p-galleria [value]="items()" [numVisible]="5"
      [showThumbnailNavigators]="items().length > 5" ... />
  }
  ```
  Ẩn nút ‹ › của dải thumbnail khi đã hiện đủ phần tử (PrimeNG khóa chúng, để hiện là nút chết).
- **Style theo lớp bọc của mình**, không theo `containerClass` (không gắn lên DOM): `:host ::ng-deep .lop-boc .p-galleria-…`.
- **Nút ‹ › trên ảnh lớn**: nút ‹ đứng trước ảnh trong DOM nên bị ảnh đè — đặt `z-index: 1` cho
  `.p-galleria-nav-button`; nền mặc định trắng 10% không thấy trên ảnh sáng → nền tối (`rgb(0 0 0 / .5)`).
- **Thumbnail mờ**: PrimeNG để ô chưa chọn `opacity: .5` — nâng lên (~.8) và viền ô đang chọn.
- **Toàn màn hình (`[fullScreen]`)**: mask gắn ra `body` → style qua `maskClass="x"` + `::ng-deep .x` (không
  `:host`); phần tử viết trong template `#item` vẫn nhận style của component. Template `#header` KHÔNG được
  render — thanh công cụ đặt trong template `#item` với `position: fixed`. Độ rộng ô thumbnail do `<style>` theo
  `#id` quyết định → chỉ `!important` đè được (ghi chú lý do cạnh rule).
- Mask có hiệu ứng mở (`p-overlay-mask-enter-active`): test đọc màu nền / chụp ảnh thì chờ hiệu ứng xong
  (`toHaveCSS` trên màu nền cuối) — chụp giữa chừng ra nền nhạt và ảnh méo.

