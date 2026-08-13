---
name: api-services
description: 'Viết service gọi API trong frontend PMIS3: cấu trúc service, HTTP call, model/DTO, xử lý toast qua errorInterceptor, confirm dialog, API context theo từng microservice.'
---

# Skill: API & Service Patterns

## Khi nào áp dụng
Khi tạo/sửa services, gọi API, xử lý HTTP responses.

## API Response Format
```typescript
interface ApiResponse<T> {
  code: number;
  type: 'SUCCESS' | 'ERROR' | 'WARNING';
  message?: string;
  data?: T;
  count?: number;      // Total records (pagination)
  countPage?: number;  // Total pages
}
```

## Service Pattern
```typescript
import { AC_QUANTRI } from '@/app/constants/api-context.constant';

@Injectable({ providedIn: 'root' })
export class MyService {
  private readonly baseUrl = `${environment.BASE_URL}/${AC_QUANTRI}/my-resource`;

  constructor(private readonly http: HttpClient) {}

  getAll(params?: { keyword?: string; page?: number; size?: number }): Observable<ApiResponse<T[]>> {
    return this.http.get<ApiResponse<T[]>>(this.baseUrl, { params: params as any });
  }

  getById(id: string): Observable<ApiResponse<T>> {
    return this.http.get<ApiResponse<T>>(`${this.baseUrl}/${id}`);
  }

  create(data: Partial<T>): Observable<ApiResponse<T>> {
    return this.http.post<ApiResponse<T>>(this.baseUrl, data);
  }

  update(data: Partial<T>): Observable<ApiResponse<T>> {
    return this.http.put<ApiResponse<T>>(this.baseUrl, data);
  }

  delete(id: string): Observable<ApiResponse<void>> {
    return this.http.delete<ApiResponse<void>>(`${this.baseUrl}/${id}`);
  }
}
```

## Service dùng chung nhiều microservice (context-path động)

Mỗi microservice backend có module **giống hệt nhau**, **chỉ khác context-path** (vd quản lý file:
`pmis3-nguon-quantri/v1/file` vs `pmis3-nguon-vattu/v1/file`). Khi MỘT service được component của
**nhiều microservice** dùng chung và phải gọi đúng microservice của component đang gọi:

- **KHÔNG** hard-code `AC_*` vào `baseUrl`.
- Inject `ApiContextResolver` (`@/app/core/services/api-context.resolver`) và biến `baseUrl` thành
  **getter tính theo từng lời gọi** (service là singleton `providedIn: 'root'`, dùng xuyên nhiều route
  nên field tĩnh sẽ kẹt 1 context):

```typescript
import { Injectable, inject } from '@angular/core';
import { ApiContextResolver } from '@/app/core/services/api-context.resolver';

@Injectable({ providedIn: 'root' })
export class FileService {
  private readonly http = inject(HttpClient);
  private readonly ctx = inject(ApiContextResolver);
  private get baseUrl(): string {
    return `${environment.BASE_URL}/${this.ctx.resolve()}/file`;
  }
  // ... các method dùng this.baseUrl như bình thường
}
```

`ApiContextResolver.resolve()` đọc `Router.url`, lấy **segment route đầu tiên**, tra map
`ROUTE_API_CONTEXT` trong `api-context.constant.ts` → context-path microservice; route không khớp →
`DEFAULT_API_CONTEXT` (= `AC_QUANTRI`). **Thêm microservice mới = thêm 1 dòng vào `ROUTE_API_CONTEXT`**
(vd `vattu: AC_VATTU`); component KHÔNG cần sửa gì.

**Phân biệt:**
- Service **riêng 1 microservice** (đặt trong thư mục feature, vd `services/vattu/*`) → hard-code
  `AC_*` của chính nó như Service Pattern ở trên.
- Service **dùng chung nhiều microservice** (file, example-file...) → dùng `ApiContextResolver`.

Giới hạn: resolver dựa vào route hiện tại → chỉ đúng khi lời gọi xuất phát từ trang đang mở. Nếu cần
gọi ngoài ngữ cảnh route (background job), phải truyền context tường minh.

## Toast Notifications - KHÔNG tự show
`errorInterceptor` tự động xử lý toast. Component KHÔNG gọi `messageService.add()`:

```typescript
// ĐÚNG
operation.subscribe({
  next: () => {
    this.dialogVisible.set(false);
    this.loadData();
  },
  error: () => {
    this.loading.set(false);
  }
});

// SAI
operation.subscribe({
  next: () => {
    this.messageService.add({ severity: 'success', ... }); // Duplicate!
  }
});
```

## HTTP Interceptors (thứ tự trong app.config.ts)
1. `loadingInterceptor` - Global loading state
2. `authInterceptor` - Credentials, 401 token refresh
3. `errorInterceptor` - Error handling, toast notifications

## Confirm Dialog - Async/Await
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

## Model Convention - AuditDTO
Models có audit fields PHẢI extend `AuditDTO`:
```typescript
import { AuditDTO } from '@/app/models/common.model';

export interface SSiteDTO extends AuditDTO {
  siteid: string;
  sitedesc: string;
  active: boolean;
  // Audit fields inherited: userCrId, userCrName, userCrDtime, userMdfId, userMdfName, userMdfDtime
}
```
