---
name: ui-conventions
description: 'Quy ước giao diện BẮT BUỘC của PMIS3: page wrapper tw-p-2 bg-white, KHÔNG dùng h-full vì gây thanh cuộn thừa, KHÔNG có tiêu đề h1 trong trang (breadcrumb đã hiển thị tên trang), thanh tìm kiếm w-72 cùng hàng với nút hành động, định dạng ngày dd/MM/yyyy, màu active của sidebar. Đọc khi dựng trang mới hoặc chỉnh layout, toolbar, ngày tháng.'
---

# UI Conventions

Các quy tắc giao diện bắt buộc áp dụng cho toàn bộ project.

## Page Layout

**Page wrapper** — div ngoài cùng của mọi trang:
```html
<div class="tw-p-2 bg-white">
```
- Padding: `tw-p-2` (0.5rem)
- Background: `bg-white`
- **Ngoại lệ**: Dashboard không áp dụng rule này

**Page full-height — KHÔNG dùng `h-full`** (gây thanh cuộn thừa ~97px):
```html
<div class="tw-p-2 bg-white min-h-[calc(100vh_-_var(--app-topbar-height))] flex flex-col">
```
- `.content-area` của layout xếp dọc: header (sticky) + breadcrumb (sticky) + page; container này KHÔNG có
  chiều cao cố định. Nên `h-full` (`height:100%`) làm page cao = 100% content-area, cộng thêm header+breadcrumb
  → tổng vượt viewport ~97px → **thanh cuộn thừa dù còn nhiều khoảng trống**.
- Dùng `min-h-[calc(100vh_-_var(--app-topbar-height))]`: page chỉ chiếm phần còn lại **dưới** topbar.
  `--app-topbar-height` (= header 49px + breadcrumb 48px) đã khai báo ở `.main-layout`, kế thừa xuống page.
- Dùng `min-height` (không phải `height`): nội dung ngắn vẫn phủ kín nền trắng tới đáy, nội dung dài thì page
  giãn ra và content-area cuộn tự nhiên.
- Lưu ý cú pháp Tailwind: dấu cách trong `calc()` viết bằng `_` → `calc(100vh_-_var(--app-topbar-height))`.

**Page title — KHÔNG có.** Trang KHÔNG tự render `<h1>` tên màn hình. Tên trang do **breadcrumb** của
`main-layout` hiển thị (lấy từ `data.breadcrumb` của route, mục cuối in đậm màu primary, thanh breadcrumb
dính ngay dưới header). Khai báo `data: { breadcrumb: 'Tên màn hình' }` ở route là đủ.
- Trang chi tiết (route con) cũng khai `breadcrumb` riêng — nút "Quay lại" giữ, tiêu đề bỏ.
- Ngoại lệ: `PagePanelComponent` (overlay chi tiết full-page) có `[title]` riêng vì nó che cả breadcrumb.

**Toolbar đầu trang** — tìm kiếm + nút hành động **cùng một hàng**, thay cho hàng tiêu đề cũ:
```html
<div class="flex flex-wrap justify-between items-center gap-2 mb-3">
  <p-iconfield iconPosition="left" class="w-72 max-w-full">
    <p-inputicon styleClass="pi pi-search" />
    <input pInputText type="text" placeholder="Tìm kiếm..." (input)="onSearch($event)" />
  </p-iconfield>
  @if (canCreate()) {
    <p-button label="Tạo mới" icon="pi pi-plus" (onClick)="openCreateDialog()" severity="primary" />
  }
</div>
```
- Thanh tìm kiếm rộng `w-72` (18rem). **KHÔNG** đặt `w-full` lên `<p-iconfield>` kể cả kèm breakpoint
  (`w-full md:w-96`): `styles.css` có rule `p-iconfield.w-full { width: 100% }` đặc hiệu hơn utility
  responsive nên thanh luôn bị full chiều rộng.
- Trang không có tìm kiếm (tabs, panel nhóm…): nút hành động căn phải `flex justify-end items-center mb-2`.

## Định dạng ngày tháng

Ngày/giờ hiển thị (mọi nơi: bảng, form, card chi tiết...) theo đúng các định dạng:
- Chỉ ngày (không giờ): **`dd/MM/yyyy`**
- Ngày + giờ, phút: **`dd/MM/yyyy HH:mm`**
- Ngày + giờ, phút, giây: **`dd/MM/yyyy HH:mm:ss`**

```html
{{ item.ngayTao | date:'dd/MM/yyyy' }}
{{ item.thoiDiem | date:'dd/MM/yyyy HH:mm' }}
{{ item.thoiDiem | date:'dd/MM/yyyy HH:mm:ss' }}
```
Thiếu giá trị → hiển thị `—` (giống `AuditHistoryCardComponent`).

## Sidebar / Menu

**Active state color**: `#21BCFF` (cyan) — chỉ dùng làm **màu nhấn** (chữ/icon/vạch/viền),
KHÔNG tô nền đặc. Nền active luôn là tông nhạt `#e0f7ff` để không chọi màu icon SVG nhiều màu.
- Top-level menu item active: background `#e0f7ff`, text `#0369a1`, icon `#21BCFF`,
  viền `inset 0 0 0 1px #a5e4ff`, `font-weight: 600`
- Top-level menu item active hover: background `#cbeeff`
- Submenu / drawer tree link active: background `#e0f7ff`, text `#0369a1`, border-left `#21BCFF`
- Submenu / drawer tree link active hover: background `#b3eeff`
- Submenu icon active: `#21BCFF`
