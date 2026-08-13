---
name: ui-conventions
description: 'Quy ước giao diện BẮT BUỘC của PMIS3: page wrapper tw-p-2 bg-white, KHÔNG dùng h-full vì gây thanh cuộn thừa, tiêu đề text-lg, định dạng ngày dd/MM/yyyy, màu active của sidebar. Đọc khi dựng trang mới hoặc chỉnh layout, tiêu đề, ngày tháng.'
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

**Page title** — thẻ `<h1>` tiêu đề trang:
```html
<h1 class="text-lg font-bold text-primary-800">Tên màn hình</h1>
```
- Dùng `text-lg`, KHÔNG dùng `text-2xl`

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
