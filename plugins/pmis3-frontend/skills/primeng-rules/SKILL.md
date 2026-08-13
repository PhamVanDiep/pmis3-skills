---
name: primeng-rules
description: 'Quy tắc BẮT BUỘC khi dùng PrimeNG 20 trong PMIS3: dùng TabsModule thay vì TabView, p-treeTableToggler viết hoa chữ T, luôn appendTo="body" cho p-select/p-dropdown/p-multiselect trong dialog, nút tải xuống cho p-image. Đọc khi đụng tới bất kỳ component PrimeNG nào.'
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
