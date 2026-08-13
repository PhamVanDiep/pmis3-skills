---
name: angular-patterns
description: 'Quy tắc Angular BẮT BUỘC của mọi frontend PMIS3: prefix tw- chỉ cho class padding, dùng signal()/computed() thay BehaviorSubject, extend BaseComponent, KHÔNG tự gọi toast, lấy đơn vị từ AppStore, phân trang UI 1-based và API 0-based, path alias @/*. Đọc TRƯỚC khi viết hoặc sửa bất kỳ component/service Angular nào.'
---

# Angular Patterns

Quy tắc bắt buộc liên quan đến Angular trong project.

## TailwindCSS `tw-` prefix

Chỉ dùng prefix `tw-` cho các class bắt đầu bằng chữ **p** (padding):
```html
tw-p-2, tw-p-4, tw-px-6, tw-py-3, tw-pt-4 ...
```
Các class khác dùng bình thường (không prefix):
```html
flex, grid, gap-4, mb-3, text-sm, bg-white ...
```
Lý do: PrimeNG conflict với Tailwind `p-*` utilities.

## Signals

Dùng `signal()` và `computed()` cho mọi reactive state (zoneless mode, không có Zone.js):
```ts
protected readonly items = signal<Item[]>([]);
protected readonly total = computed(() => this.items().length);
```
KHÔNG dùng `BehaviorSubject` hay property thường cho UI state.

## BaseComponent

Mọi page component đều phải extend `BaseComponent` và gọi `super.ngOnInit()`:
```ts
export class MyPage extends BaseComponent implements OnInit {
  ngOnInit() {
    super.ngOnInit();
    // ...
  }
}
```

## Toast

KHÔNG tự gọi toast — `errorInterceptor` xử lý tự động cho lỗi API.
Chỉ dùng `MessageService` cho thông báo thành công thủ công nếu cần.

## Org Filter

Dùng `AppStore.selectedOrganization()` để lấy đơn vị hiện tại, KHÔNG tạo dropdown chọn đơn vị trong form.

## Search Keyword

Giá trị mặc định là `''` (chuỗi rỗng), KHÔNG dùng `undefined`:
```ts
protected readonly searchKeyword = signal('');
```

## Pagination

- UI: 1-based (hiển thị cho người dùng)
- API: 0-based (truyền lên server)
```ts
page: this.currentPage() - 1
```

## Path Alias

`@/*` maps đến `src/*`:
```ts
import { AuthStore } from '@/app/core/store';
import { UserDTO } from '@/app/models/user.model';
```

## API Context theo Microservice

- Service **riêng 1 microservice** → hard-code `AC_*` của nó trong `baseUrl` (bình thường).
- Service **dùng chung nhiều microservice** (API giống nhau, chỉ khác context-path — vd `FileService`,
  `ExampleFileService`): KHÔNG hard-code `AC_*`. Inject `ApiContextResolver`
  (`@/app/core/services/api-context.resolver`) và để `baseUrl` là **getter** gọi `this.ctx.resolve()`
  (tính theo route hiện tại). Map route→context khai báo ở `ROUTE_API_CONTEXT` trong
  `api-context.constant.ts`; thêm microservice = thêm 1 dòng. Chi tiết: skill `api-services.md`.

## Danh mục được gán (Granted Catalog)

Cần danh sách **đơn vị / nhà máy / tổ máy được gán quyền** lọc theo tham số → gọi API `/granted/*`
(`/granted/organizations`, `/granted/plants`, `/granted/mainassets`). Bộ endpoint này có ở **mọi
microservice** (nhúng qua security-starter), nên chức năng thuộc microservice nào thì gọi của **chính
microservice đó**: dùng `GrantedCatalogService` với `baseUrl` là getter qua `ApiContextResolver`,
KHÔNG hard-code `AC_QUANTRI`. Đây khác với Org Filter ở header (cây đơn vị toàn cục của quantri).
Chi tiết + code service: skill `granted-catalog.md`.
