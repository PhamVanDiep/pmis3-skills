---
name: granted-catalog
description: 'Lấy danh sách đơn vị, nhà máy, tổ máy ĐƯỢC GÁN QUYỀN theo tham số qua API /granted/* (organizations, plants, mainassets). Bộ endpoint này có ở mọi microservice nên phải gọi đúng microservice của chức năng, KHÔNG hard-code quantri.'
---

# Skill: Granted Catalog (đơn vị / nhà máy / tổ máy được gán)

## Khi nào áp dụng

Khi một chức năng cần lấy **danh sách đơn vị / nhà máy / tổ máy mà người dùng hiện tại được gán quyền**, lọc theo tham số (để đổ dropdown, filter, picker...).

Backend cung cấp bộ endpoint `/granted/*` này trong **mọi microservice** (nhúng sẵn qua `pmis3-security-starter`). Vì vậy:

> **QUY TẮC:** Chức năng thuộc microservice nào thì gọi `/granted/*` của **chính microservice đó** — KHÔNG gọi cố định về `quantri`. Dùng `ApiContextResolver` (ca "dùng chung nhiều microservice", xem `api-services.md`).

Phân biệt với **Org Filter** ở header (`AppStore.selectedOrganization()` + `OrganizationService.getGrantedTree()` của `quantri`): đó là cây đơn vị toàn cục cho bộ chọn đơn vị chung. Skill này dành cho **danh mục lọc-theo-tham-số bên trong màn hình của một microservice**.

## Endpoints

Tương đối với context-path của microservice (vd `{BASE_URL}/pmis3-nguon-vattu/v1`):

| Method + Path | Query params (đều optional) | Trả về |
|---------------|-----------------------------|--------|
| `GET /granted/organizations` | `orglevel` | `IOrganizationGranted[]` |
| `GET /granted/plants` | `orgid`, `pfueltypeid` | `IPlantGranted[]` |
| `GET /granted/mainassets` | `orgid`, `plantid`, `magroupid` | `IMainassetGranted[]` |

Mã hợp lệ của tham số enum (chỉ là danh sách mã, truyền lên như query string):
- `orglevel`: `P`, `G`, `E`
- `pfueltypeid`: `2801TD`, `2802THAN`, `2803DAU`, `2804TBK`, `2805DMT`
- `magroupid`: `3201HC`, `3202TM`, `3203L`

Hành vi:
- Yêu cầu JWT hợp lệ (đã do `authInterceptor` xử lý — không cần làm gì thêm).
- `orgid` / `plantid` chỉ **thu hẹp** trên tập đã được gán (an toàn quyền). Cả hai null ở `mainassets` → lấy theo toàn bộ nhà máy được gán.
- Người dùng thường: chỉ thấy mục được gán. `ROLE_SUPER_ADMIN`: thấy toàn bộ, `readonly = null`.
- `organizations`/`plants` có `readonly` (`null`/không có = ghi được, `true` = chỉ đọc). `mainassets` KHÔNG có `active`/`readonly`.

## Models

Đặt ở `@/app/models/granted-catalog.model.ts` (dùng chung, không thuộc module microservice cụ thể):

```typescript
export interface IOrganizationGranted {
  orgid: string;
  orgdesc: string;
  orgcode: string;
  orglevel: string;
  orgord: number;
  orgidParent: string;
  readonly: boolean | null;
}

export interface IPlantGranted {
  plantid: string;
  plantdesc: string;
  orgid: string;
  plantord: number;
  pfueltypeid: string;
  readonly: boolean | null;
}

export interface IMainassetGranted {
  mainassetid: string;
  madesc: string;
  maord: number;
  magroupid: string;
  plantid: string;
  orgid: string;
}
```

## Service (dùng chung nhiều microservice → `ApiContextResolver`)

Đặt ở `@/app/services/granted-catalog.service.ts`. Vì service là singleton `providedIn: 'root'` dùng xuyên nhiều microservice, `baseUrl` phải là **getter** tính theo route hiện tại (KHÔNG hard-code `AC_*`):

```typescript
import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '@/environments/environment';
import { ApiResponse } from '@/app/models/api.model';
import { ApiContextResolver } from '@/app/core/services/api-context.resolver';
import {
  IOrganizationGranted,
  IPlantGranted,
  IMainassetGranted,
} from '@/app/models/granted-catalog.model';

@Injectable({ providedIn: 'root' })
export class GrantedCatalogService {
  private readonly http = inject(HttpClient);
  private readonly ctx = inject(ApiContextResolver);

  /** Getter: resolve context-path của microservice theo route đang mở. */
  private get baseUrl(): string {
    return `${environment.BASE_URL}/${this.ctx.resolve()}/granted`;
  }

  /** Đơn vị được gán. orglevel: P | G | E (optional). */
  getOrganizations(orglevel?: string): Observable<ApiResponse<IOrganizationGranted[]>> {
    const params = orglevel ? { orglevel } : {};
    return this.http.get<ApiResponse<IOrganizationGranted[]>>(
      `${this.baseUrl}/organizations`, { params },
    );
  }

  /** Nhà máy được gán. orgid, pfueltypeid (optional). */
  getPlants(orgid?: string, pfueltypeid?: string): Observable<ApiResponse<IPlantGranted[]>> {
    const params: Record<string, string> = {};
    if (orgid) params['orgid'] = orgid;
    if (pfueltypeid) params['pfueltypeid'] = pfueltypeid;
    return this.http.get<ApiResponse<IPlantGranted[]>>(
      `${this.baseUrl}/plants`, { params },
    );
  }

  /** Tổ máy được gán. orgid, plantid, magroupid (optional). */
  getMainassets(
    orgid?: string, plantid?: string, magroupid?: string,
  ): Observable<ApiResponse<IMainassetGranted[]>> {
    const params: Record<string, string> = {};
    if (orgid) params['orgid'] = orgid;
    if (plantid) params['plantid'] = plantid;
    if (magroupid) params['magroupid'] = magroupid;
    return this.http.get<ApiResponse<IMainassetGranted[]>>(
      `${this.baseUrl}/mainassets`, { params },
    );
  }
}
```

> Nếu microservice của bạn chưa có trong `ROUTE_API_CONTEXT` (`api-context.constant.ts`), thêm 1 dòng `segment: AC_XXX` để `ApiContextResolver.resolve()` trỏ đúng — component không cần sửa gì.

## Sử dụng trong component

```typescript
private readonly grantedCatalog = inject(GrantedCatalogService);
protected readonly plants = signal<IPlantGranted[]>([]);

private loadPlants() {
  // đang ở màn hình của microservice nào → tự gọi /granted/plants của microservice đó
  this.grantedCatalog.getPlants(this.orgid(), this.fuelType()).subscribe({
    next: (res) => this.plants.set(res.data ?? []),
  });
}
```

## ĐÚNG / SAI

```typescript
// ĐÚNG — baseUrl getter qua ApiContextResolver: gọi đúng microservice của màn hình hiện tại
private get baseUrl(): string {
  return `${environment.BASE_URL}/${this.ctx.resolve()}/granted`;
}

// SAI — hard-code AC_QUANTRI: chức năng của microservice khác (vattu/sxd...) sẽ gọi nhầm về quantri
private readonly baseUrl = `${environment.BASE_URL}/${AC_QUANTRI}/granted`;
```
