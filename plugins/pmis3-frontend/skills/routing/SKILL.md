---
name: routing
description: 'Khai báo route, lazy loading và guard trong frontend PMIS3. Dùng khi thêm màn hình hoặc module mới vào hệ thống route.'
---

# Skill: Routing Conventions

## Khi nào áp dụng
Khi tạo routes mới, thêm page mới, cấu hình navigation.

## Cấu trúc Route theo Module
```
src/app/
├── app.routes.ts                     # Root routes - chỉ top-level paths
└── pages/
    ├── admin/
    │   └── admin.routes.ts           # ADMIN_ROUTES
    ├── vt-nc-mtc/
    │   └── vt-nc-mtc.routes.ts       # VT_NC_MTC_ROUTES
    └── {module}/
        └── {module}.routes.ts        # {MODULE}_ROUTES
```

## app.routes.ts - Chỉ dùng loadChildren
```typescript
// ĐÚNG
{
  path: 'admin',
  loadChildren: () => import('./pages/admin/admin.routes').then(m => m.ADMIN_ROUTES),
  data: { breadcrumb: 'Quản trị' }
}

// SAI: Không khai báo trực tiếp child routes
{
  path: 'admin',
  children: [
    { path: 'users', loadComponent: () => ... },  // Đặt trong admin.routes.ts
  ]
}
```

## Module Routes Pattern
```typescript
// src/app/pages/{module}/{module}.routes.ts
import { Routes } from '@angular/router';
import { permissionGuard } from '@/app/core/guards';

export const ADMIN_ROUTES: Routes = [
  {
    path: 'users',
    loadComponent: () => import('./users/users').then(m => m.UsersPage),
    canActivate: [permissionGuard],
    data: { breadcrumb: 'Người dùng' }
  },
];
```

## Naming Convention
- File: `{module}.routes.ts`
- Export: `{MODULE}_ROUTES: Routes` (SCREAMING_SNAKE_CASE)

## Guards
- **`authGuard`**: Chỉ ở root layout trong `app.routes.ts`
- **`permissionGuard`**: Trong từng module routes cho route cần kiểm tra quyền
- **`guestGuard`**: Chỉ cho route `/login`

## Thêm module mới
1. Tạo folder: `src/app/pages/{module}/`
2. Tạo routes: `src/app/pages/{module}/{module}.routes.ts`
3. Đăng ký trong `app.routes.ts` bằng `loadChildren`
