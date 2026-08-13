---
name: styling
description: 'Styling frontend PMIS3 bằng TailwindCSS: quy tắc prefix tw-, bảng màu, cỡ chữ và spacing toàn cục. Dùng khi chỉnh giao diện hoặc viết CSS.'
---

# Skill: Styling - TailwindCSS & PrimeNG

## Khi nào áp dụng
Khi viết CSS classes, styling components.

## TailwindCSS tw- prefix (QUAN TRỌNG)
Chỉ dùng tiền tố `tw-` khi thuộc tính TailwindCSS bắt đầu bằng chữ `p` (conflict với PrimeNG):
- `p-`, `px-`, `py-`, `pt-`, `pr-`, `pb-`, `pl-`, `ps-`, `pe-` → dùng `tw-p-`, `tw-px-`, `tw-py-`, ...

```html
<!-- ĐÚNG -->
<div class="tw-p-4 tw-px-6 tw-py-2">Content</div>

<!-- SAI - conflict với PrimeNG -->
<div class="p-4 px-6 py-2">Content</div>
```

Các class khác (margin, flex, grid, colors...) dùng bình thường, KHÔNG thêm `tw-`:
```html
<div class="flex items-center gap-4 m-4 bg-primary-100">Content</div>
```

## Primary Color System
Primary: `#313193` (primary-800). Scale 50-950:
```html
<div class="bg-primary-800 text-white">Content</div>
<button class="border-primary-700 hover:bg-primary-600">Click</button>
```

## Global Component Sizing
PrimeNG components đã style globally nhỏ hơn mặc định:
- Font size: 0.875rem (14px)
- Input padding: 0.25rem 0.5rem
- Button padding: 0.25rem 1rem
- Checkbox/Radio: 1.25rem

## Component Style
- Components dùng SCSS
- Dùng TailwindCSS utilities trong templates
- Global styles: `src/styles/styles.css` (CSS, không SCSS - required cho TailwindCSS v4)

## Override PrimeNG internal CSS
Khi cần ghi đè CSS của các phần tử bên trong PrimeNG component (ví dụ `.p-inputnumber-input`, `.p-datatable-*`), **bắt buộc** dùng `:host ::ng-deep` trong SCSS của component. Nếu không, Angular view encapsulation sẽ chặn style không cho xuyên tới DOM nội bộ của PrimeNG.

```scss
// ĐÚNG
:host ::ng-deep {
  .p-inputnumber-input {
    width: 100% !important;
  }
}

// SAI - style sẽ không được áp dụng
.p-inputnumber-input {
  width: 100% !important;
}
```
