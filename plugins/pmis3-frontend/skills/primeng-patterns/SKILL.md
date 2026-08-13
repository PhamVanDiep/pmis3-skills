---
name: primeng-patterns
description: 'Mẫu dùng PrimeNG trong PMIS3: tabs, treetable, checkbox và các component hay dùng khác. Dùng khi dựng giao diện bằng PrimeNG.'
---

# Skill: PrimeNG Component Patterns

## Khi nào áp dụng
Khi sử dụng PrimeNG components trong templates.

## Case-sensitive Components (QUAN TRỌNG)

### Tabs
```typescript
import { TabsModule } from 'primeng/tabs';         // ĐÚNG
// import { TabView } from 'primeng/tabview';       // SAI
```
```html
<p-tabs>
  <p-tabpanel header="Tab 1">Content</p-tabpanel>
</p-tabs>
<!-- <p-tabview> SAI -->
```

### TreeTable Toggler - Capital T
```typescript
import { TreeTableModule } from 'primeng/treetable';
```
```html
<p-treeTableToggler [rowNode]="rowNode" />   <!-- ĐÚNG: Capital T -->
<!-- <p-treetableToggler /> SAI: lowercase t -->
```

## p-table Standard StyleClass (BẮT BUỘC)
Tất cả `<p-table>` PHẢI có:
```html
<p-table
  styleClass="p-datatable-sm p-datatable-striped"
  [rowHover]="true"
  ...
>
```
- `p-datatable-sm`: Compact size
- `p-datatable-striped`: Zebra striping
- `[rowHover]="true"`: Highlight row on hover

## PrimeNG Full Width Pattern
```html
<p-select class="w-full" [options]="items" />
<p-password styleClass="w-full" inputStyleClass="w-full" />
<p-button styleClass="w-full" label="Submit" />
<input pInputText class="w-full" />
```

**QUAN TRỌNG**: Trong `<p-dialog>`, luôn thêm `appendTo="body"` cho dropdown components:
```html
<!-- Trong dialog -->
<p-select appendTo="body" class="w-full" [options]="items" />
<p-dropdown appendTo="body" class="w-full" [options]="items" />
<p-multiselect appendTo="body" class="w-full" [options]="items" />
```
Lý do: Tránh dropdown overlay render trong dialog gây cuộn khó chịu.

## TreeNode Toggle Pattern
Khi handle TreeNode events trong TreeTable, LUÔN pass `rowNode.node` (không phải `rowNode`):

```html
<p-treetable [value]="treeData">
  <ng-template pTemplate="body" let-rowNode let-rowData="rowData">
    <tr [ttRow]="rowNode">
      <td>
        <p-checkbox
          [ngModel]="rowData.selected"
          (onChange)="onNodeToggle(rowNode.node, $event)"
        />
        <!-- SAI: (onChange)="onNodeToggle(rowNode, $event)" -->
      </td>
    </tr>
  </ng-template>
</p-treetable>
```

```typescript
onNodeToggle(node: TreeNode, event: any) {
  const checked = !!event?.checked;
}
```

## Checkbox Column Pattern
Tables có checkbox PHẢI có checkbox ở header để select/deselect all:

```html
<ng-template pTemplate="header">
  <tr>
    <th style="width: 60px" class="text-center">
      <p-checkbox [binary]="true" [ngModel]="isAllItemsSelected()" (onChange)="toggleAllItems($event)" />
    </th>
  </tr>
</ng-template>
```

```typescript
protected selectedIds = signal<Set<string>>(new Set());

isItemSelected(id: string): boolean {
  return this.selectedIds().has(id);
}

isAllItemsSelected(): boolean {
  const items = this.filteredItems();
  if (items.length === 0) return false;
  return items.every((item) => this.selectedIds().has(item.id));
}

toggleAllItems(event: any) {
  const checked = !!event?.checked;
  const currentIds = new Set(this.selectedIds());
  const items = this.filteredItems();
  if (checked) {
    items.forEach((item) => currentIds.add(item.id));
  } else {
    items.forEach((item) => currentIds.delete(item.id));
  }
  this.selectedIds.set(currentIds);
}

toggleItem(id: string, event: any) {
  const checked = !!event?.checked;
  const currentIds = new Set(this.selectedIds());
  checked ? currentIds.add(id) : currentIds.delete(id);
  this.selectedIds.set(currentIds);
}
```

Key: Luôn tạo new Set() khi update để trigger signal change detection.
