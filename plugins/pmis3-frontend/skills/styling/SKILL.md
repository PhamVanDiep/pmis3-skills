---
name: styling
description: 'Styling frontend PMIS3 bằng TailwindCSS: quy tắc prefix tw-, design token màu (primary + text token cho màu chữ form/table/hint), cỡ chữ và spacing toàn cục. Dùng khi chỉnh giao diện, viết CSS hoặc chọn màu chữ.'
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

## Design token màu
Mọi màu đều là token trong `@theme static` của `src/styles/styles.css` — **nguồn duy nhất**, hex chỉ
xuất hiện ở đó. PrimeNG preset, AG Grid theme và SCSS component tham chiếu `var(--color-*)`.

### Primary
Primary: `#313193` (primary-800). Scale 50-950:
```html
<div class="bg-primary-800 text-white">Content</div>
<button class="border-primary-700 hover:bg-primary-600">Click</button>
```

### Text token (màu chữ)
Ba bậc, chọn theo vai trò của chữ:

| Token | Giá trị | Tailwind class | Dùng cho |
|---|---|---|---|
| `--color-text-strong` | `#000000` | `text-text-strong` | giá trị input/cell, label, header cột, option dropdown |
| `--color-text-secondary` | `#6b7280` | `text-text-secondary` | hint dưới input, subtitle dòng 2 trong cell, cột phụ |
| `--color-text-muted` | `#9ca3af` | `text-text-muted` | placeholder, icon gợi ý, dòng/ô disabled |

Màu ngữ nghĩa vẫn dùng trực tiếp: `text-red-500` lỗi validate, `text-primary-*` link/nhấn, tag/badge.
Màu chữ trung tính chỉ đi qua ba token trên — `text-gray-*`, `text-slate-*` và hex trong SCSS là
sai chuẩn.

```html
<label class="text-sm font-semibold">Mã thiết bị</label>              <!-- label: mặc định đã strong -->
<td>
  <div>{{ row.ten }}</div>                                              <!-- giá trị: mặc định đã strong -->
  <div class="text-xs text-text-secondary">{{ row.maSo }}</div>         <!-- subtitle -->
</td>
<small class="text-text-secondary">Tối đa 50 ký tự</small>              <!-- hint -->
<span class="text-text-muted">Chưa có dữ liệu</span>                    <!-- trạng thái trống -->
```

Label, cell p-table/AG Grid, input và option dropdown **tự nhận** `strong` qua cấu hình global —
không thêm class màu cho chúng. Cấu hình chuẩn (áp dụng y hệt cho mọi app PMIS3):

```css
/* src/styles/styles.css */
@theme static {                /* static: phát sinh biến kể cả khi template không dùng, vì TS tham chiếu */
  --color-text-strong: #000000;
  --color-text-secondary: #6b7280;
  --color-text-muted: #9ca3af;
}
label { color: var(--color-text-strong); }
```

```ts
// app.config.ts — definePreset(Aura, { semantic: { ..., colorScheme: { light: {
text: { color: 'var(--color-text-strong)', mutedColor: 'var(--color-text-secondary)' },
// Aura map formField.color thẳng tới surface.700, không qua text.color → phải set riêng
formField: { color: 'var(--color-text-strong)', placeholderColor: 'var(--color-text-muted)' },
// }}}}); và providePrimeNG({ theme: { options: { darkModeSelector: false } } }) — app chỉ có light theme
```

```ts
// shared/ag-grid/ag-grid-theme.ts
themeAlpine.withParams({ foregroundColor: 'var(--color-text-strong)' })
```

```scss
// SCSS component: tham chiếu token, không hex
.pick-sub { color: var(--color-text-secondary); }
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
