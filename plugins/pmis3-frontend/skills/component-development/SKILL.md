---
name: component-development
description: 'Tạo hoặc sửa component Angular trong PMIS3: cấu trúc standalone component, extend BaseComponent, hiển thị UI theo quyền canCreate/canUpdate/canDelete.'
---

# Skill: Component Development

## Khi nào áp dụng
Khi tạo mới hoặc chỉnh sửa Angular component, page.

## Quy tắc bắt buộc

### Standalone Components
Tất cả component đều standalone, KHÔNG dùng NgModules:

```typescript
@Component({
  selector: 'app-my-component',
  standalone: true,
  imports: [CommonModule, Button, InputText],
  templateUrl: './my-component.html',
  styleUrl: './my-component.scss'
})
export class MyComponent {}
```

### Signals cho Reactive State (Zoneless Mode)
App chạy zoneless (`provideZonelessChangeDetection()`), BẮT BUỘC dùng signals:

```typescript
protected readonly data = signal<Data[]>([]);
protected readonly loading = signal(false);
protected readonly doubled = computed(() => this.count() * 2);
```

### Page Components phải extend BaseComponent
Tất cả page components PHẢI extend `BaseComponent` (`src/app/core/base.component.ts`):

```typescript
import { BaseComponent } from '@/app/core/base.component';

export class UsersPage extends BaseComponent implements OnInit {
  constructor() { super(); }

  override ngOnInit(): void {
    super.ngOnInit(); // BẮT BUỘC: Load permissions
    this.loadData();
  }
}
```

BaseComponent cung cấp:
- `currentUser`, `currentOrg`, `currentOrgId` - User/org hiện tại
- `canCreate()`, `canUpdate()`, `canDelete()`, `canRead()`, `isSuperAdmin()` - Permission checks
- `destroy$` - Subject cho cleanup subscriptions
- `permissionGranted` - Full permission object

### Permission-based UI
```html
@if (canCreate()) {
  <p-button label="Thêm mới" icon="pi pi-plus" severity="success" (onClick)="openCreateDialog()" />
}
@if (canUpdate() || canDelete()) {
  <th class="text-right">Thao tác</th>
}
```

### Component Properties
- `protected` hoặc `public` cho template-accessible
- `private` cho internal
- `readonly` cho signals và injected services
- `private readonly` cho injected services

### Lifecycle
```typescript
export class MyComponent implements OnInit, OnDestroy {
  ngOnInit(): void { }
  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}
```
