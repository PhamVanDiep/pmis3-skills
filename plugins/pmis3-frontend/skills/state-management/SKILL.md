---
name: state-management
description: 'Quản lý state frontend PMIS3 bằng signal: AuthStore, AppStore và các store dùng chung. Dùng khi cần chia sẻ state giữa component hoặc đọc thông tin người dùng và đơn vị hiện tại.'
---

# Skill: State Management

## Khi nào áp dụng
Khi làm việc với stores, signals, reactive state.

## Signal-based Stores (BaseStore)
```typescript
import { BaseStore } from '@/app/core/store';

interface MyState {
  data: any[];
  loading: boolean;
}

@Injectable({ providedIn: 'root' })
export class MyStore extends BaseStore<MyState> {
  constructor() { super({ data: [], loading: false }); }

  readonly data = computed(() => this.state().data);      // Selector
  readonly loading = computed(() => this.state().loading);

  setData(data: any[]) { this.patchState({ data, loading: false }); }
  setLoading(loading: boolean) { this.patchState({ loading }); }
}
```

BaseStore methods: `setState()`, `patchState()`, `updateState()`, `resetState()`

## Available Stores
- **AuthStore**: User info, token expiration, auth state (persisted to localStorage)
- **AppStore**: Sidebar state, theme, notifications, selectedOrganization

## Authentication Flow
- JWT tokens: HTTP-only cookies (backend)
- User info + token expiration: localStorage
- `authGuard` -> `/login` with returnUrl
- `guestGuard` -> prevent auth users accessing login
- Auto token refresh on 401 via `authInterceptor`

## AppStore - Organization Selection
```typescript
import { AppStore } from '@/app/core/store';

constructor(private readonly appStore: AppStore) {}

protected selectedOrgId = computed<string | null>(
  () => this.appStore.selectedOrganization()?.orgid || null
);
```
