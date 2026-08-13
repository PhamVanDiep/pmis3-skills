---
name: permissions
description: 'Kiểm tra phân quyền trong frontend PMIS3 và màn hình quản lý quyền. Dùng khi cần ẩn/hiện chức năng theo quyền người dùng.'
---

# Skill: Permissions System

## Khi nào áp dụng
Khi implement permission checks, trang quản lý phân quyền.

## BaseComponent Permissions
Tất cả page components extend BaseComponent để có permission checks:

```typescript
// Available signals (protected)
canCreate(): boolean   // Quyền thêm mới
canUpdate(): boolean   // Quyền cập nhật
canDelete(): boolean   // Quyền xóa
canRead(): boolean     // Quyền xem
isSuperAdmin(): boolean // Super admin có tất cả quyền
hasPermission(key: keyof UserRolesGranted): boolean
```

Template:
```html
@if (canCreate()) {
  <p-button label="Thêm mới" icon="pi pi-plus" severity="success" />
}
@if (canUpdate() || canDelete()) {
  <th class="text-right">Thao tác</th>
}
```

## Permissions Page (/admin/permissions)
- **Mode Toggle**: Radio "Theo người dùng" / "Theo nhóm quyền"
- **2-Column Layout**: Left=list table, Right=permission tabs
- **3 Tabs**: Chức năng, Đơn vị, Nhà máy
- **Function Permissions**: TreeTable - Checkbox | Tên | Thêm mới | Cập nhật | Xóa
- **Org Permissions**: Table - grant/revoke, readonly, default (role only)
- **Plant Permissions**: Table - grant/revoke, readonly
- Tree nodes default `expanded: true`
- forkJoin cho load/save multiple permission types
- Save all changes in single batch
