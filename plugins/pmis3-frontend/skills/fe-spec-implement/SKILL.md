---
name: fe-spec-implement
description: 'Dựng trọn một chức năng CRUD frontend từ file SPEC do backend sinh ra: model, service, page và route. Dùng khi có file SPEC và cần implement đầy đủ màn hình.'
---

# Skill: FE Spec Implementation

## Khi nào áp dụng
Khi user cung cấp đường dẫn đến file SPEC (ví dụ `docs/FE_CA_TRUC_SPEC.md`) và yêu cầu implement chức năng FE theo spec đó.

---

## Bước 1 — Đọc và phân tích SPEC

Đọc file SPEC được cung cấp trong `$ARGUMENTS` (hoặc hỏi user nếu không có).

Từ SPEC, extract các thông tin sau:

| Thông tin | Lấy từ mục |
|-----------|-----------|
| **Tên chức năng** (tiếng Việt) | Mục "Tổng quan" |
| **DTO interface** (tên, fields, types, constraints) | Mục "Data Model" |
| **API base path** | URL của các endpoint |
| **Danh sách endpoints** | Mục "API Endpoints" — method, URL, params |
| **Primary key field** | Field bắt buộc, không thay đổi được khi edit |
| **Table columns** | "Gợi ý UI" của GET list |
| **Form fields + validation** | Mục "Validation" / request body của POST/PUT |
| **Mã chức năng** (permission code) | "Mã chức năng" trong Tổng quan |

---

## Bước 2 — Hỏi user về target paths

Nếu chưa rõ từ context, hỏi user **một lần** các thông tin:

1. **Pages module folder** — thư mục chứa trang (ví dụ: `src/app/pages/admin/he-thong`)
2. **Route URL path** — segment URL cho route (ví dụ: `ca-truc`)
3. **Routes file** — file routes cần đăng ký (ví dụ: `src/app/pages/admin/he-thong/he-thong.routes.ts`)
4. **Service subfolder** — thư mục trong `src/app/services/` (ví dụ: `quantri`)
5. **Model subfolder** — thư mục trong `src/app/models/` (ví dụ: `quantri`)
6. **Breadcrumb label** — tên hiển thị trên breadcrumb (ví dụ: `'Ca trực'`)

Nếu SPEC file có tên theo pattern `FE_{MODULE}_SPEC.md`, gợi ý tự động từ đó.

---

## Bước 3 — Lập kế hoạch files cần tạo

Dựa trên `{feature}` là kebab-case của chức năng (ví dụ `ca-truc`), `{FeatureClass}` là PascalCase (ví dụ `CaTruc`):

```
src/app/models/{model-subfolder}/{feature}.model.ts       ← DTO interface
src/app/services/{service-subfolder}/{feature}.service.ts ← HTTP service
src/app/pages/{module-path}/{feature}/{feature}.ts        ← Page component
src/app/pages/{module-path}/{feature}/{feature}.html      ← Template
src/app/pages/{module-path}/{feature}/{feature}.scss      ← Styles
```

Và sửa file routes để đăng ký route mới.

---

## Bước 4 — Tạo Model

File: `src/app/models/{model-subfolder}/{feature}.model.ts`

**Quy tắc:**
- Import và extend `AuditDTO` từ `@/app/models/common.model`
- Map đúng tất cả fields từ SPEC Data Model section
- `?` cho optional fields, không có `?` cho required fields (macatruc, orgid)
- Field types: `string`, `number`, `boolean` (không dùng `Date`)

```typescript
import { AuditDTO } from '@/app/models/common.model';

export interface {FeatureClass}DTO extends AuditDTO {
  // required fields (bắt buộc theo SPEC)
  {pkField}: string;
  orgid: string;
  // optional fields từ SPEC
  {field}?: {type};
}
```

---

## Bước 5 — Tạo Service

File: `src/app/services/{service-subfolder}/{feature}.service.ts`

**Quy tắc:**
- `AC_QUANTRI` từ `@/app/constants/api-context.constant` là `pmis3/v1`
- `baseUrl` = `${environment.BASE_URL}/${AC_QUANTRI}/{api-path}`
- Chỉ implement các method ứng với endpoints có trong SPEC
- Method `update()` truyền PK qua `params`, data qua body
- Method `delete()` truyền PK qua `params`

```typescript
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@/environments/environment';
import { ApiResponse } from '@/app/models/api.model';
import { {FeatureClass}DTO } from '@/app/models/{model-subfolder}/{feature}.model';
import { AC_QUANTRI } from '@/app/constants/api-context.constant';

@Injectable({ providedIn: 'root' })
export class {FeatureClass}Service {
  private readonly baseUrl = `${environment.BASE_URL}/${AC_QUANTRI}/{api-path}`;

  constructor(private readonly http: HttpClient) {}

  // Nếu SPEC có GET list (phân trang)
  getAll(params?: { keyword?: string; page?: number; size?: number }): Observable<ApiResponse<{FeatureClass}DTO[]>> {
    return this.http.get<ApiResponse<{FeatureClass}DTO[]>>(this.baseUrl, { params: params as any });
  }

  // Nếu SPEC có GET /all (không phân trang)
  getAllNoPagination(): Observable<ApiResponse<{FeatureClass}DTO[]>> {
    return this.http.get<ApiResponse<{FeatureClass}DTO[]>>(`${this.baseUrl}/all`);
  }

  // Nếu SPEC có GET detail
  getDetail({pkField}: string): Observable<ApiResponse<{FeatureClass}DTO>> {
    return this.http.get<ApiResponse<{FeatureClass}DTO>>(`${this.baseUrl}/detail`, { params: { {pkField} } });
  }

  // Nếu SPEC có POST
  create(data: Partial<{FeatureClass}DTO>): Observable<ApiResponse<{FeatureClass}DTO>> {
    return this.http.post<ApiResponse<{FeatureClass}DTO>>(this.baseUrl, data);
  }

  // Nếu SPEC có PUT
  update({pkField}: string, data: Partial<{FeatureClass}DTO>): Observable<ApiResponse<{FeatureClass}DTO>> {
    return this.http.put<ApiResponse<{FeatureClass}DTO>>(this.baseUrl, data, { params: { {pkField} } });
  }

  // Nếu SPEC có DELETE
  delete({pkField}: string): Observable<ApiResponse<null>> {
    return this.http.delete<ApiResponse<null>>(this.baseUrl, { params: { {pkField} } });
  }
}
```

---

## Bước 6 — Tạo Page Component (TypeScript)

File: `src/app/pages/{module-path}/{feature}/{feature}.ts`

**Quy tắc bắt buộc:**
- Extend `BaseComponent`, gọi `super.ngOnInit()`
- Dùng `signal()` và `computed()` — KHÔNG dùng BehaviorSubject hay property thường
- Pagination: UI 1-based (`currentPage = signal(1)`), API 0-based (`page: currentPage() - 1`)
- Search: dùng `Subject + debounceTime(300)` trong constructor
- Org filter: `effect(() => { const orgId = this.currentOrgId(); ... })` trong constructor
- Dialog: dùng `p-dialog` trực tiếp trong template (KHÔNG dùng PagePanel)
- Dialog mode: `signal<'create' | 'edit'>('create')`
- Form: `FormGroup` với `FormControl` và Validators theo SPEC
- Khi edit: disable PK field và `orgid` bằng `form.get(field)?.disable()` / `.enable()`
- `getRawValue()` khi submit để lấy giá trị cả field disabled
- KHÔNG tự gọi MessageService — errorInterceptor xử lý tự động
- Sau save/delete thành công: gọi `loadData()`
- `takeUntil(this.destroy$)` cho mọi subscription

**Template TypeScript:**

```typescript
import { Component, OnInit, computed, signal, effect, untracked } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { Button } from 'primeng/button';
import { Dialog } from 'primeng/dialog';
import { InputText } from 'primeng/inputtext';
import { Tooltip } from 'primeng/tooltip';
import { IconField } from 'primeng/iconfield';
import { InputIcon } from 'primeng/inputicon';
import { Tag } from 'primeng/tag';
// Thêm các PrimeNG imports cần thiết dựa trên form fields trong SPEC
// InputNumber nếu có trường số; Textarea nếu có mota dài; Checkbox nếu có boolean; Select nếu có dropdown
import { debounceTime, distinctUntilChanged, Subject, takeUntil } from 'rxjs';

import { {FeatureClass}Service } from '@/app/services/{service-subfolder}/{feature}.service';
import { {FeatureClass}DTO } from '@/app/models/{model-subfolder}/{feature}.model';
import { ConfirmDialogService } from '@/app/shared/components/confirm-dialog/confirm-dialog.service';
import { BaseComponent } from '@/app/core/base.component';

@Component({
  selector: 'app-{feature}',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TableModule,
    Button,
    Dialog,
    InputText,
    Tooltip,
    IconField,
    InputIcon,
    Tag,
    // thêm PrimeNG components cần thiết
  ],
  templateUrl: './{feature}.html',
  styleUrl: './{feature}.scss'
})
export class {FeatureClass}Page extends BaseComponent implements OnInit {
  private searchSubject = new Subject<string>();

  // Thêm static data options nếu có (ví dụ dayOptions, kieuCaOptions)

  protected readonly items = signal<{FeatureClass}DTO[]>([]);
  protected readonly loading = signal(false);
  protected readonly totalRecords = signal(0);
  protected readonly currentPage = signal(1);
  protected readonly pageSize = signal(20);

  protected readonly dialogVisible = signal(false);
  protected readonly dialogMode = signal<'create' | 'edit'>('create');
  protected readonly dialogTitle = computed(() =>
    this.dialogMode() === 'create' ? 'Tạo mới {Tên chức năng}' : 'Cập nhật {Tên chức năng}'
  );

  protected readonly searchKeyword = signal('');

  // FormGroup: mỗi field từ SPEC với Validator đúng với constraint (maxLength, required)
  protected form = new FormGroup({
    {pkField}: new FormControl('', [Validators.required, Validators.maxLength({pkMaxLength})]),
    // ... các field khác theo SPEC
  });

  constructor(
    private readonly {featureCamel}Service: {FeatureClass}Service,
    private readonly confirmDialogService: ConfirmDialogService
  ) {
    super();

    this.searchSubject
      .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
      .subscribe((keyword) => {
        this.searchKeyword.set(keyword);
        this.currentPage.set(1);
        this.loadData();
      });

    effect(() => {
      const orgId = this.currentOrgId();
      if (!orgId) return;
      untracked(() => {
        this.currentPage.set(1);
        this.loadData();
      });
    });
  }

  override ngOnInit() {
    super.ngOnInit();
  }

  override ngOnDestroy() {
    super.ngOnDestroy();
  }

  loadData() {
    this.loading.set(true);
    this.{featureCamel}Service
      .getAll({
        keyword: this.searchKeyword() || '',
        page: this.currentPage() - 1,
        size: this.pageSize()
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          this.items.set(response.data || []);
          this.totalRecords.set(response.count || 0);
          this.loading.set(false);
        },
        error: () => { this.loading.set(false); }
      });
  }

  onPageChange(event: any) {
    this.currentPage.set(Math.floor((event?.first ?? 0) / (event.rows ?? 1)) + 1);
    this.pageSize.set(event.rows);
    this.loadData();
  }

  onSearch(event: Event) {
    const value = (event.target as HTMLInputElement).value;
    this.currentPage.set(1);
    this.searchSubject.next(value);
  }

  openCreateDialog() {
    this.dialogMode.set('create');
    this.form.reset({ /* default values */ });
    this.form.get('{pkField}')?.enable();
    this.dialogVisible.set(true);
  }

  openEditDialog(item: {FeatureClass}DTO) {
    this.dialogMode.set('edit');
    this.loading.set(true);
    this.{featureCamel}Service
      .getDetail(item.{pkField})
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          const detail = response.data;
          if (detail) {
            this.form.patchValue({ /* patch all fields from detail */ });
            this.form.get('{pkField}')?.disable();
            this.dialogVisible.set(true);
          }
          this.loading.set(false);
        },
        error: () => { this.loading.set(false); }
      });
  }

  save() {
    if (this.form.invalid) return;
    const formValue = this.form.getRawValue();
    const data: Partial<{FeatureClass}DTO> = {
      {pkField}: formValue.{pkField} || '',
      orgid: this.currentOrgId() || '',
      // map các fields khác, dùng || undefined cho optional string rỗng
    };
    const operation =
      this.dialogMode() === 'create'
        ? this.{featureCamel}Service.create(data)
        : this.{featureCamel}Service.update(formValue.{pkField}!, data);
    operation.pipe(takeUntil(this.destroy$)).subscribe({
      next: () => { this.dialogVisible.set(false); this.loadData(); },
      error: () => {}
    });
  }

  async deleteItem(item: {FeatureClass}DTO) {
    const confirmed = await this.confirmDialogService.show({
      title: 'Xác nhận xóa',
      message: `Bạn có chắc chắn muốn xóa {Tên chức năng} "${item.{labelField} || item.{pkField}}"?`,
      acceptLabel: 'Xóa',
      rejectLabel: 'Hủy',
      acceptIcon: 'pi pi-trash',
      rejectIcon: 'pi pi-times'
    });
    if (confirmed) {
      this.{featureCamel}Service.delete(item.{pkField})
        .pipe(takeUntil(this.destroy$))
        .subscribe({ next: () => { this.loadData(); }, error: () => {} });
    }
  }
}
```

---

## Bước 7 — Tạo Template HTML

File: `src/app/pages/{module-path}/{feature}/{feature}.html`

**Cấu trúc bắt buộc:**

```html
<div class="tw-p-2 bg-white">
  <!-- Header: title + nút Tạo mới (permission-gated) -->
  <div class="flex justify-between items-center mb-2">
    <h1 class="text-lg font-bold text-primary-800">{Tên màn hình}</h1>
    @if (canCreate()) {
      <p-button label="Tạo mới" icon="pi pi-plus" (onClick)="openCreateDialog()" severity="primary" />
    }
  </div>

  <!-- Search bar -->
  <div class="md:flex md:justify-between md:items-center gap-4 mb-4">
    <p-iconfield iconPosition="left" class="w-full md:w-96">
      <p-inputicon styleClass="pi pi-search" />
      <input pInputText type="text" placeholder="Tìm kiếm..." (input)="onSearch($event)" />
    </p-iconfield>
  </div>

  <!-- Data table -->
  <p-table
    [value]="items()"
    [loading]="loading()"
    [paginator]="true"
    [rows]="pageSize()"
    [totalRecords]="totalRecords()"
    [lazy]="true"
    (onLazyLoad)="onPageChange($event)"
    [rowsPerPageOptions]="[10, 20, 50, 100]"
    [paginatorDropdownAppendTo]="'body'"
    [showCurrentPageReport]="true"
    currentPageReportTemplate="Hiển thị {first} - {last} / {totalRecords} bản ghi"
    styleClass="p-datatable-sm p-datatable-striped"
    [rowHover]="true"
  >
    <!-- Columns từ "Gợi ý UI" trong SPEC -->
    <ng-template pTemplate="header">
      <tr>
        <!-- Các <th> theo SPEC, với width hợp lý -->
        <!-- Cột cuối: width đủ cho hover pill (2 nút = 100px) -->
      </tr>
    </ng-template>

    <ng-template pTemplate="body" let-item>
      <tr class="group cursor-pointer" (dblclick)="openEditDialog(item)">
        <!-- Các <td> tương ứng header -->
        <!-- Cột cuối: relative overflow-hidden + hover pill -->
        <td class="text-center relative overflow-hidden" style="width: 100px">
          <!-- Nội dung cột cuối (ví dụ: p-tag trạng thái, ord) -->
          @if (canUpdate() || canDelete()) {
            <div class="absolute inset-y-0 right-0 flex items-center pr-2 opacity-0 group-hover:opacity-100 transition-all duration-200">
              <div class="flex items-center gap-0.5 bg-white rounded-full shadow-md border border-gray-200 px-1">
                @if (canUpdate()) {
                  <p-button icon="pi pi-pencil" [rounded]="true" [text]="true" size="small" severity="info"
                    (onClick)="openEditDialog(item); $event.stopPropagation()" pTooltip="Sửa" tooltipPosition="top" />
                }
                @if (canDelete()) {
                  <p-button icon="pi pi-trash" [rounded]="true" [text]="true" size="small" severity="danger"
                    (onClick)="deleteItem(item); $event.stopPropagation()" pTooltip="Xóa" tooltipPosition="top" />
                }
              </div>
            </div>
          }
        </td>
      </tr>
    </ng-template>

    <ng-template pTemplate="emptymessage">
      <tr>
        <td [attr.colspan]="{số cột}" class="text-center tw-py-8 text-gray-500">
          Không tìm thấy dữ liệu
        </td>
      </tr>
    </ng-template>
  </p-table>

  <!-- Create/Edit Dialog -->
  <p-dialog
    [header]="dialogTitle()"
    [(visible)]="dialogVisible"
    [modal]="true"
    [closable]="true"
    [draggable]="false"
    [style]="{ width: '700px' }"
  >
    <form [formGroup]="form" class="flex flex-col gap-4">
      <!-- Fields theo SPEC:
           - PK field: readonly khi edit (dùng @if dialogMode() === 'edit')
           - grid grid-cols-2 gap-4 cho fields 2 cột
           - p-select/p-dropdown appendTo="body"
           - p-inputnumber cho số
           - p-checkbox [binary]="true" cho boolean
           - textarea pTextarea cho mô tả dài
           - Validation message: @if (form.get('field')?.invalid && form.get('field')?.touched)
      -->
    </form>

    <ng-template pTemplate="footer">
      <div class="flex gap-2 justify-end">
        <p-button label="Hủy" icon="pi pi-times" severity="secondary" (onClick)="dialogVisible.set(false)" />
        <p-button label="Lưu" icon="pi pi-check" (onClick)="save()" [disabled]="form.invalid" />
      </div>
    </ng-template>
  </p-dialog>
</div>
```

---

## Bước 8 — Tạo SCSS

File: `src/app/pages/{module-path}/{feature}/{feature}.scss`

```scss
// Để trống — styles được xử lý bởi TailwindCSS và PrimeNG theme
```

---

## Bước 9 — Đăng ký Route

Mở file routes (ví dụ `he-thong.routes.ts`), thêm entry mới:

```typescript
{
  path: '{route-path}',
  loadComponent: () => import('./{feature}/{feature}').then(m => m.{FeatureClass}Page),
  canActivate: [permissionGuard],
  data: { breadcrumb: '{Breadcrumb Label}' }
},
```

---

## Checklist trước khi hoàn thành

- [ ] Model extends `AuditDTO`, tất cả fields đúng type và optional/required theo SPEC
- [ ] Service: chỉ có methods ứng với endpoints trong SPEC
- [ ] Page extends `BaseComponent`, gọi `super.ngOnInit()`
- [ ] Search dùng `debounceTime(300)` + `distinctUntilChanged()`
- [ ] Org filter dùng `effect` + `untracked`
- [ ] Pagination: UI 1-based, API 0-based (`currentPage() - 1`)
- [ ] Form: `Validators.required` + `Validators.maxLength` đúng theo SPEC
- [ ] Edit: PK field và orgid bị disable; `getRawValue()` khi submit
- [ ] Hover pill đặt trên cột cuối (`relative overflow-hidden` trên `<td>`, KHÔNG trên `<tr>`)
- [ ] `$event.stopPropagation()` trên mỗi action button
- [ ] Tất cả `p-select`/`p-dropdown`/`p-multiselect` trong dialog có `appendTo="body"`
- [ ] `[paginatorDropdownAppendTo]="'body'"` trên `p-table`
- [ ] Route đã được đăng ký trong file routes

---

## Quy tắc đặt tên nhanh

| Pattern | Ví dụ |
|---------|-------|
| Feature kebab | `ca-truc` |
| FeatureClass PascalCase | `CaTruc` |
| featureCamel camelCase | `caTruc` |
| Service | `CaTrucService` |
| Page class | `CaTrucPage` |
| Selector | `app-ca-truc` |
| DTO | `CaTrucDTO` hoặc `OpNkvhLstCaTrucDTO` (dùng tên có trong SPEC) |
