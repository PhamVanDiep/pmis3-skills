# Unit test (Vitest)

Tham chiếu của skill [`testing`](SKILL.md). Mọi spec import helper từ `@/testing`.

## Bộ khung `src/testing`

| Helper | Dùng để |
|---|---|
| `provideTestDefaults({ permissions?, routes?, realInterceptors? })` | Provider nền: zoneless, HttpClient + `HttpTestingController`, router, `MessageService`, `ConfirmationService`, stub quyền màn hình. `realInterceptors: true` gắn `authInterceptor` + `errorInterceptor` như app thật |
| `FULL_PERMISSIONS`, `READ_ONLY`, `permissionStub(q)` | Quyền cho `BaseComponent` (`canCreate/canUpdate/canDelete`) |
| `expectRequest(ctrl, { method, path, params })` | Bắt đúng một request theo method + đuôi đường dẫn, so từng param; báo rõ param sai |
| `respond(ctrl, expected, data)` | `expectRequest` + `flush(apiOk(data))` |
| `apiOk(data, extra)`, `apiPage(rows, count)`, `apiError(message)` | Body `ApiResponse` chuẩn; `count` là tổng bản ghi |
| `builder<T>(seq => defaults)`, `listOf(build, n, overrides)` | Dữ liệu mẫu có kiểu DTO |
| `selectOrganization(org?)`, `signIn()`, `TEST_ORG` | Đơn vị đang chọn (header `orgid`), phiên đăng nhập |
| `useFixedTime(iso)` | Cố định `Date` trong một `describe` |

`src/test-setup.ts` tự `vi.restoreAllMocks()` sau mỗi test — spy không rò sang test sau.

## Hàm thuần nghiệp vụ

Mọi quy tắc tính toán/phân loại/chuyển trạng thái là hàm thuần trong `<feature>.logic.ts`, test bằng bảng.
Mỗi ngưỡng có ba dòng: **dưới**, **đúng bằng**, **trên** ngưỡng.

```ts
// su-co.logic.spec.ts
import { hanXuLy, laQuaHan } from './su-co.logic';

describe('hạn xử lý khiếm khuyết theo mức độ', () => {
  // Nguồn: SPEC khiếm khuyết §3.2 — mức 1: 24h, mức 2: 7 ngày, mức 3: 30 ngày
  it.each([
    { mucDo: 1, phatHien: '2026-09-01 08:00:00', han: '2026-09-02 08:00:00' },
    { mucDo: 2, phatHien: '2026-09-01 08:00:00', han: '2026-09-08 08:00:00' },
    { mucDo: 3, phatHien: '2026-09-01 08:00:00', han: '2026-10-01 08:00:00' }
  ])('mức $mucDo phát hiện $phatHien → hạn $han', ({ mucDo, phatHien, han }) => {
    expect(hanXuLy(mucDo, phatHien)).toBe(han);
  });

  describe('quá hạn', () => {
    useFixedTime('2026-09-02T08:00:00+07:00');
    it.each([
      { han: '2026-09-02 07:59:59', quaHan: true },
      { han: '2026-09-02 08:00:00', quaHan: false }, // đúng hạn chưa tính quá hạn
      { han: '2026-09-02 08:00:01', quaHan: false }
    ])('hạn $han → quá hạn: $quaHan', ({ han, quaHan }) => expect(laQuaHan(han)).toBe(quaHan));
  });
});
```

Chuỗi thời điểm backend là LOCAL `yyyy-MM-dd HH:mm:ss` — dùng `parseLocalDateTime` / `formatLocalDateTime`
(`shared/utils/date.util`), không đi qua `toISOString()`.

## Service

```ts
describe('ThietBiService', () => {
  let service: ThietBiService;
  let ctrl: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: provideTestDefaults({ realInterceptors: true }) });
    service = TestBed.inject(ThietBiService);
    ctrl = TestBed.inject(HttpTestingController);
  });
  afterEach(() => ctrl.verify()); // không request nào bị bỏ sót

  it('search gửi keyword rỗng, page 0-based và trả về tổng số bản ghi', () => {
    let tong: number;
    service.search({ keyword: '', page: 0, size: 20 }).subscribe((r) => (tong = r.count));
    expectRequest(ctrl, { method: 'GET', path: 'thiet-bi/search', params: { keyword: '', page: 0 } })
      .flush(apiPage([], 57));
    expect(tong).toBe(57);
  });

  it('mang header orgid của đơn vị đang chọn', () => {
    const org = selectOrganization();
    service.search({ keyword: '', page: 0, size: 20 }).subscribe();
    expect(expectRequest(ctrl, { method: 'GET', path: 'thiet-bi/search' }).request.headers.get('orgid')).toBe(org.orgid);
  });
});
```

Mẫu đầy đủ đang chạy: `src/app/services/quantri/lib-folder.service.spec.ts`.

## Component

Chỉ test logic riêng của component. Service giả bằng object `vi.fn()`, quyền qua `provideTestDefaults`.

```ts
describe('SuCoDetailPage — nút theo trạng thái × quyền', () => {
  async function mo(trangThai: string, permissions = FULL_PERMISSIONS) {
    const svc = { getDetail: vi.fn().mockReturnValue(of(apiOk(aSuCo({ trangThai })))) };
    TestBed.configureTestingModule({
      imports: [SuCoDetailPage],
      providers: [...provideTestDefaults({ permissions }), { provide: SuCoService, useValue: svc }]
    });
    const fixture = TestBed.createComponent(SuCoDetailPage);
    fixture.componentRef.setInput('id', 'SC01');
    await fixture.whenStable();
    return fixture.nativeElement as HTMLElement;
  }
  const nut = (el: HTMLElement) => [...el.querySelectorAll('button')].map((b) => b.textContent.trim());

  it.each([
    { trangThai: 'MOI', co: ['Giao xử lý'], khong: ['Nghiệm thu'] },
    { trangThai: 'DA_XU_LY', co: ['Nghiệm thu', 'Trả lại'], khong: ['Giao xử lý'] },
    { trangThai: 'DONG', co: [], khong: ['Giao xử lý', 'Nghiệm thu', 'Trả lại'] }
  ])('trạng thái $trangThai hiện $co', async ({ trangThai, co, khong }) => {
    const el = await mo(trangThai);
    co.forEach((t) => expect(nut(el)).toContain(t));
    khong.forEach((t) => expect(nut(el)).not.toContain(t));
  });

  it('chỉ có quyền xem thì không có nút thao tác nào', async () => {
    expect(nut(await mo('MOI', READ_ONLY))).not.toContain('Giao xử lý');
  });
});
```

- Zoneless: sau khi đổi input/signal gọi `await fixture.whenStable()` trước khi đọc DOM.
- Overlay PrimeNG (dialog, select) render vào `document.body` — đọc qua `document.querySelector`, dọn
  trong `afterEach`.
- Chart/grid: test **dữ liệu** component đưa vào (series, rowData, cột) qua thuộc tính của component,
  không đọc pixel/SVG.

## Chuyển từ Jasmine

| Jasmine | Vitest |
|---|---|
| `jasmine.createSpyObj('S', ['a'])` | `{ a: vi.fn() }` (kiểu `MockedObject<S>`) |
| `spy.and.returnValue(x)` / `.and.resolveTo(x)` | `spy.mockReturnValue(x)` / `.mockResolvedValue(x)` |
| `spyOn(obj, 'm')` | `vi.spyOn(obj, 'm')` |
| `spy.calls.mostRecent().args` | `spy.mock.lastCall` |
| `expect(x).withContext('lý do').toBe(y)` | `expect(x, 'lý do').toBe(y)` |
| `toBeTrue()` / `toBeFalse()` | `toBe(true)` / `toBe(false)` |
| `jasmine.objectContaining` | `expect.objectContaining` |
| `spy.and.returnValues(a, b)` | `spy.mockReturnValueOnce(a).mockReturnValueOnce(b)` |
| `spy.calls.reset()` / `.calls.count()` | `spy.mockClear()` / `spy.mock.calls.length` |
| `toHaveBeenCalledOnceWith(…)` | `toHaveBeenCalledExactlyOnceWith(…)` |
| `jasmine.clock().install()` / `.tick(n)` | `useFakeTimersExceptRaf()` / `vi.advanceTimersByTime(n)` |
| `jasmine.clock().mockDate(d)` | `vi.setSystemTime(d)` |
| `await expectAsync(p).toBeResolvedTo(v)` | `await expect(p).resolves.toEqual(v)` |
| `NoopAnimationsModule` | bỏ — `src/test-setup.ts` đã tắt hiệu ứng CSS |

Schematic chuyển tự động: `ng g @schematics/angular:refactor-jasmine-vitest`. **Không dùng nguyên kết quả**:
schematic (và mọi migration của `ng update`) in lại CẢ file — đổi thụt lề, nháy, gộp dòng; có prettier trong
project thì nó còn format lại toàn file. Diff hàng nghìn dòng không review được. Cách làm đúng: codemod nhắm
đúng đoạn API (giữ format gốc) rồi chạy prettier riêng cho file spec theo cấu hình của repo. Cũng đừng
nhận nguyên các migration "tối ưu" tùy chọn (vd gỡ `CommonModule` hàng loạt) — tự sửa có chủ đích.

## Bẫy thường gặp

- Unit test chạy trong Chrome thật (browser mode): có layout, `execCommand`, `DragEvent`… đúng như app.
- Thư viện Node-only (vd `sockjs-client`) cần alias sang bản trình duyệt trong `vitest.config.ts`.
- Biến toàn cục app khai ở `index.html` phải khai lại trong `src/test-setup.ts`.
- `HttpTestingController.verify()` trong `afterEach` của mọi spec có HTTP.
- **Hiệu ứng PrimeNG 21** (`pMotion`): `onShow`/`onHide` của dialog, bộ nghe Esc… chỉ chạy khi hiệu ứng CSS
  KẾT THÚC. `src/test-setup.ts` đặt mọi `animation/transition-duration: 0s` — thiếu nó thì `(onShow)="nap()"`
  không bao giờ chạy và cả spec của dialog đỏ hàng loạt.
- **Đồng hồ giả**: dùng `useFakeTimersExceptRaf()` (`@/testing`). `vi.useFakeTimers()` trơn giả cả
  `requestAnimationFrame` — Angular zoneless lên lịch change detection bằng rAF nên `fixture.whenStable()` treo
  tới hết giờ.
- **Viewport**: Vitest browser mặc định 414px; test đo layout / `elementFromPoint` cần
  `"browserViewport": "1280x800"` trong `angular.json → test.options` (điểm ngoài viewport trả `null`).
- **`vi.spyOn` GỌI hàm thật** (Jasmine `spyOn` thì không). Muốn chặn thì thêm `.mockImplementation(() => undefined)`.
  Vitest không tự gỡ spy giữa các test — `test-setup.ts` gọi `vi.restoreAllMocks()` sau mỗi test.
- `toContain` trên mảng so `===` (Jasmine so sâu) — mảng object dùng `toContainEqual`.
- File tiện ích chỉ dùng cho test KHÔNG đặt đuôi `.spec.ts` (Vitest báo "No test suite found") — để trong
  `src/testing/` (đã loại khỏi `tsconfig.app.json`).
- **PrimeNG 21 `Dialog.close()` tự ẩn hộp** khi Esc / ✕ / bấm nền (PrimeNG 20 chỉ phát `visibleChange`). Hộp
  điều khiển một chiều `[visible]="hien()" (visibleChange)="$event ? null : dongLai()"` (đang ghi không cho
  đóng, còn thay đổi thì hỏi) phải gắn directive giữ hành vi cũ (`appDialogDoChaQuyetDinh` ở
  `pmis3-nguon-frontend`) — test Esc thật (`nhanEscThat()`) sẽ bắt lỗi này.
- Spec theo prettier của repo (`npx prettier --write "src/**/*.spec.ts"`), viết xong thì format.
