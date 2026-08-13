---
name: coding-standards
description: 'Chuẩn code frontend PMIS3: thứ tự import, quy tắc đặt tên, định dạng, cấu hình project (Angular 20 zoneless, PrimeNG Aura, TailwindCSS 4). Áp dụng cho mọi lần viết code frontend.'
---

# Skill: Coding Standards & Conventions

## Khi nào áp dụng
Luôn áp dụng khi viết code trong project này.

## Project Config
- Angular 20.3.13, Zoneless mode, CSR only
- PrimeNG 20.4.0 (Aura theme) + TailwindCSS 4.1.18
- TypeScript strict mode, `strictNullChecks: false`, `noImplicitAny: false`

## Import Order
1. Angular core (`@angular/core`)
2. Angular features (`@angular/common`, `@angular/router`, `@angular/forms`)
3. Third-party (`primeng/*`, `rxjs`)
4. App imports (`@/app/...`)
5. Relative imports (`./...`)

## Path Aliases
- `@/*` maps to `src/*`
- Dùng: `import { AuthStore } from '@/app/core/store'`
- Không dùng: `import { AuthStore } from '../../../core/store'`

## File Naming (kebab-case)
```
my-component.ts, my-component.html, my-component.scss
my.service.ts, my.store.ts, my.model.ts, my.guard.ts
```

## Formatting (Prettier)
- 100 chars max width
- Single quotes
- 2 spaces indent
- Angular HTML parser cho .html files

## Key Patterns
- `private readonly` cho injected services
- `protected readonly` cho signals dùng trong template
- `signal()` cho mutable state, `computed()` cho derived state
- `takeUntil(this.destroy$)` cho subscriptions
- KHÔNG dùng `ChangeDetectorRef.detectChanges()` (zoneless mode)

## Constants
```typescript
import { AC_QUANTRI } from '@/app/constants/api-context.constant';
// AC_QUANTRI = 'pmis3/v1'

import { SYSTEM_VARIABLE } from '@/app/constants/app-common.constant';
```

## Documentation Policy
- KHÔNG tạo .md files (IMPLEMENTATION.md, SYSTEM.md, etc.) trừ khi user yêu cầu
- KHÔNG tạo docs/ folder
- Chỉ tạo code files (.ts, .html, .scss) và config files
