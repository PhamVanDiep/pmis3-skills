---
name: forms-dialogs
description: 'Reactive form và dialog thêm/sửa trong PMIS3, kèm xác nhận xóa. Dùng khi làm form nhập liệu hoặc dialog CRUD.'
---

# Skill: Forms & Dialog Patterns

## Khi nào áp dụng
Khi tạo/sửa form, dialog tạo mới/chỉnh sửa dữ liệu.

## Reactive Forms
```typescript
import { FormControl, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';

protected myForm = new FormGroup({
  name: new FormControl('', [Validators.required, Validators.minLength(3)]),
  email: new FormControl('', [Validators.required, Validators.email]),
  active: new FormControl(true),
});

onSubmit() {
  if (this.myForm.valid) {
    const formValue = this.myForm.getRawValue();
    // Handle submission
  }
}
```

## p-select / p-dropdown trong Dialog
**QUAN TRỌNG**: Tất cả `p-select`, `p-dropdown`, `p-multiselect` trong dialog PHẢI có `appendTo="body"` để tránh cuộn dialog:

```html
<!-- ĐÚNG ✓ -->
<p-select
  formControlName="parentId"
  [options]="options()"
  appendTo="body"
  class="w-full"
/>

<!-- SAI ✗ - thiếu appendTo="body" -->
<p-select
  formControlName="parentId"
  [options]="options()"
  class="w-full"
/>
```

**Lý do**: Không có `appendTo="body"`, dropdown overlay render bên trong dialog gây cuộn khó chịu khi p-select ở gần cuối dialog.

## Dialog Forms - KHÔNG chọn đơn vị
Forms trong dialog KHÔNG hiển thị dropdown chọn đơn vị. `orgid` tự động lấy từ header:

```typescript
// ĐÚNG: Form không có orgid
protected userForm = new FormGroup({
  userid: new FormControl('', [Validators.required]),
  username: new FormControl('', [Validators.required]),
  // KHÔNG có orgid field
});

// orgid tự động set khi save
save() {
  const data = {
    ...this.myForm.getRawValue(),
    orgid: this.selectedOrgId() || undefined,
  };
  this.service.create(data).subscribe({
    next: () => {
      this.dialogVisible.set(false);
      this.loadData();
    },
    error: () => this.loading.set(false)
  });
}
```

## Removed Fields
- **All Forms**: Bỏ dropdown `orgid` - tự động từ header

## Create/Edit Form — Dùng PagePanel (KHÔNG dùng p-dialog)

Mọi form thêm mới / chỉnh sửa PHẢI dùng `PagePanelComponent` (`src/app/shared/components/page-panel/page-panel.ts`), **không dùng `p-dialog`**.

`PagePanelComponent` là một full-area panel với:
- Animation slide từ phải khi mở/đóng
- Header: nút back + title bên trái, slot `[actions]` bên phải
- Body cuộn độc lập (không ảnh hưởng layout ngoài)
- Tự phủ vùng content (dưới app header, bên phải sidebar) bằng `position: fixed`

### Cấu trúc component form

Tạo một component riêng cho form (ví dụ `item-form.ts`), mount/unmount bằng `@if` trong parent:

**`item-form.ts`**:
```typescript
import { Component, Input, Output, EventEmitter, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { Button } from 'primeng/button';
import { InputText } from 'primeng/inputtext';
import { PagePanelComponent } from '@/app/shared/components/page-panel/page-panel';
import { ItemDTO } from '@/app/models/item/item.model';
import { ItemService } from '@/app/services/item/item.service';

@Component({
  selector: 'app-item-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, Button, InputText, PagePanelComponent],
  templateUrl: './item-form.html',
  styleUrl: './item-form.scss',
})
export class ItemFormComponent implements OnInit {
  @Input() mode: 'create' | 'edit' = 'create';
  @Input() editData: ItemDTO | null = null;
  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();

  private readonly itemService = inject(ItemService);
  private readonly destroy$ = new Subject<void>();
  protected saving = false;

  protected get title(): string {
    return this.mode === 'create' ? 'Thêm mới' : 'Chỉnh sửa';
  }

  protected form = new FormGroup({
    name: new FormControl('', [Validators.required]),
  });

  ngOnInit() {
    if (this.mode === 'edit' && this.editData) {
      this.form.patchValue({ name: this.editData.name });
    }
  }

  protected onSave() {
    if (this.form.invalid) { this.form.markAllAsTouched(); return; }
    this.saving = true;
    const obs = this.mode === 'create'
      ? this.itemService.create(this.form.getRawValue())
      : this.itemService.update(this.editData!.id, this.form.getRawValue());
    obs.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => { this.saving = false; this.closed.emit(); this.saved.emit(); },
      error: () => { this.saving = false; },
    });
  }

  protected onHide() { this.closed.emit(); }
}
```

**`item-form.scss`**:
```scss
:host { display: contents; }
```

**`item-form.html`**:
```html
<app-page-panel [title]="title" (closed)="onHide()">
  <ng-container actions>
    <p-button label="Hủy" icon="pi pi-times" severity="secondary"
      (onClick)="onHide()" [disabled]="saving" />
    <p-button label="Lưu" icon="pi pi-check" severity="primary"
      (onClick)="onSave()" [loading]="saving" />
  </ng-container>

  <form [formGroup]="form" class="flex flex-col gap-4 max-w-4xl mx-auto">
    <!-- form fields -->
  </form>
</app-page-panel>
```

**Parent template** — mount/unmount bằng `@if`:
```html
@if (formVisible()) {
  <app-item-form
    [mode]="formMode()"
    [editData]="editingItem()"
    (closed)="formVisible.set(false)"
    (saved)="onSaved()"
  />
}
```

**Parent component**:
```typescript
protected formVisible = signal(false);
protected formMode = signal<'create' | 'edit'>('create');
protected editingItem = signal<ItemDTO | null>(null);

openCreate() {
  this.editingItem.set(null);
  this.formMode.set('create');
  this.formVisible.set(true);
}

openEdit(item: ItemDTO) {
  this.editingItem.set(item);
  this.formMode.set('edit');
  this.formVisible.set(true);
}

onSaved() { this.loadData(); }
```

## Delete với Confirm Dialog
```typescript
async deleteItem(item: Item) {
  const confirmed = await this.confirmDialogService.show({
    title: 'Xác nhận xóa',
    message: `Bạn có chắc chắn muốn xóa "${item.name}"?`,
    acceptLabel: 'Xóa',
    rejectLabel: 'Hủy',
    acceptIcon: 'pi pi-trash',
    rejectIcon: 'pi pi-times'
  });

  if (confirmed) {
    this.service.delete(item.id).subscribe({
      next: () => this.loadData()
    });
  }
}
```
