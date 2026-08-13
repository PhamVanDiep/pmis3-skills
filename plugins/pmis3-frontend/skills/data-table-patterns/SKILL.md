---
name: data-table-patterns
description: 'Dựng bảng dữ liệu frontend PMIS3 có phân trang, tìm kiếm và lọc theo đơn vị. Dùng khi làm màn hình danh sách.'
---

# Skill: Data Table, Pagination & Search Patterns

## Khi nào áp dụng
Khi tạo trang danh sách có table, pagination, search, filter.

## Pagination (1-based UI, 0-based API)
```typescript
protected readonly currentPage = signal(1);   // UI: bắt đầu từ 1
protected readonly pageSize = signal(20);
protected readonly totalRecords = signal(0);

loadData() {
  this.service.getAll({
    keyword: this.searchKeyword() || '',     // Empty string, KHÔNG undefined
    orgid: this.selectedOrgId() || '',       // Empty string, KHÔNG undefined
    page: this.currentPage() - 1,            // API: 0-based
    size: this.pageSize()
  }).subscribe({
    next: (res) => {
      this.items.set(res.data || []);
      this.totalRecords.set(res.count || 0);
    }
  });
}

onPageChange(event: any) {
  this.currentPage.set(Math.floor((event?.first ?? 0) / (event.rows ?? 1)) + 1);
  this.pageSize.set(event.rows);
  this.loadData();
}
```

## Search với debounceTime (BẮT BUỘC khi không có nút tìm kiếm)
```typescript
private searchSubject = new Subject<string>();
protected searchKeyword = signal('');

constructor() {
  super();
  this.searchSubject
    .pipe(debounceTime(300), distinctUntilChanged(), takeUntil(this.destroy$))
    .subscribe((keyword) => {
      this.searchKeyword.set(keyword);
      this.currentPage.set(1);
      this.loadData();
    });
}

onSearch(event: Event) {
  const value = (event.target as HTMLInputElement).value;
  this.currentPage.set(1);
  this.searchSubject.next(value);
}
```

Template:
```html
<p-iconfield iconPosition="left" class="w-full md:w-96">
  <p-inputicon styleClass="pi pi-search" />
  <input pInputText type="text" placeholder="Tìm kiếm..." (input)="onSearch($event)" />
</p-iconfield>
```

## Organization Filter từ Header
Pages quản lý KHÔNG cần dropdown filter đơn vị riêng. Lấy từ AppStore:

```typescript
protected selectedOrgId = computed<string | null>(
  () => this.appStore.selectedOrganization()?.orgid || null
);

// Auto reload khi org thay đổi
effect(() => {
  const orgId = this.selectedOrgId();
  if (!orgId) return;
  untracked(() => {
    this.currentPage.set(1);
    this.loadData();
  });
});
```

## Search Keyword Convention
- Mặc định: **empty string (`''`)**, KHÔNG dùng `undefined`
- Pattern: `this.searchKeyword() || ''`
- Reset page về 1 khi search/filter thay đổi

## Row Actions — Hover to Show (BẮT BUỘC)

**Không có cột "Thao tác"**. Các nút hành động overlay `position: absolute` đè lên cột cuối cùng khi hover, không chiếm thêm cột riêng.

### Pattern (PrimeNG `p-table`)

```html
<ng-template pTemplate="header">
  <tr>
    <th>Tên</th>
    <th>Mô tả</th>
    <!-- KHÔNG có <th> cho actions -->
  </tr>
</ng-template>

<ng-template pTemplate="body" let-item>
  <tr class="group cursor-pointer" (dblclick)="canUpdate() && openEdit(item)">
    <td>{{ item.name }}</td>
    <!--
      Cột cuối: relative + overflow-hidden (BẮT BUỘC CẢ HAI).
      - relative: pill dùng td làm containing block
      - overflow-hidden: ngăn pill tràn ra ngoài td → không gây scrollbar
      - Cần đặt width đủ lớn cho pill (px hoặc % rộng hơn bình thường)
      - KHÔNG đặt relative trên <tr> — PrimeNG không đảm bảo <tr> làm containing block
    -->
    <td class="relative overflow-hidden" style="width: 180px">
      {{ item.description }}
      <div class="absolute inset-y-0 right-0 flex items-center pr-2
                  opacity-0 group-hover:opacity-100 transition-all duration-200">
        <!-- Pill nổi: bg trắng + shadow + border — không lẫn với striped rows -->
        <div class="flex items-center gap-0.5 bg-white rounded-full shadow-md border border-gray-200 px-1">
          <p-button icon="pi pi-pencil" [rounded]="true" [text]="true" size="small" severity="info"
            (onClick)="openEdit(item); $event.stopPropagation()" pTooltip="Sửa" tooltipPosition="top" />
          <p-button icon="pi pi-trash" [rounded]="true" [text]="true" size="small" severity="danger"
            (onClick)="deleteItem(item); $event.stopPropagation()" pTooltip="Xóa" tooltipPosition="top" />
        </div>
      </div>
    </td>
  </tr>
</ng-template>
```

### Quy tắc
- `class="group cursor-pointer"` trên `<tr>` — **KHÔNG** đặt `relative` trên `<tr>` (PrimeNG không đảm bảo `<tr>` làm containing block)
- Cột cuối: `class="relative overflow-hidden"` + `style="width: Npx"` đủ chứa pill — `overflow-hidden` ngăn pill tràn → không gây scrollbar
- Pill: `absolute inset-y-0 right-0` tham chiếu `<td>` → bị clip bởi `overflow-hidden` khi cần
- `opacity-0 group-hover:opacity-100 transition-all duration-200` — ẩn/hiện mượt
- `$event.stopPropagation()` trên mỗi button để không trigger `dblclick` của row
- `colspan` trong `emptymessage` bằng đúng số cột data (không cộng thêm cột action)
- **Width cột cuối theo số nút**: 2 nút ≈ 100px, 3 nút ≈ 130px, 4 nút ≈ 160px, 5 nút ≈ 200px

## Double-Click Row để mở Edit (BẮT BUỘC)
Mọi table có chức năng sửa **PHẢI** hỗ trợ double-click vào row để mở form chỉnh sửa.

```typescript
openEdit(item: ItemDTO) {
  this.editingItem.set(item);
  this.formMode.set('edit');
  this.formVisible.set(true);
}
```
