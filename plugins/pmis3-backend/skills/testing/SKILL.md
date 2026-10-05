---
name: testing
description: 'Quy tắc BẮT BUỘC viết/sửa test cho backend PMIS3 (Spring Boot) mỗi khi xây mới HOẶC hiệu chỉnh chức năng: unit test JUnit 5 + Mockito (*Test, không cần hạ tầng), integration test (*IT), test tái hiện khi sửa lỗi, ràng buộc nghiệp vụ trả 400 chứ không để CSDL ném 500. Đọc khi thêm/sửa service, endpoint, import, hoặc sửa bug backend.'
---

# Testing (backend)

Code và test là **một** thay đổi. Chức năng backend (mới hoặc sửa) CHƯA XONG khi chưa có test phủ hành vi mới
và `./mvnw test` xanh. Phía giao diện của cùng chức năng: skill `pmis3-frontend:testing` (unit + smoke + e2e).

## Hai tầng

| Tầng | Đặt tên | Chạy bằng | Phủ |
|---|---|---|---|
| Unit | `*Test` | `./mvnw test` (surefire) | Quy tắc nghiệp vụ, kiểm hợp lệ, nhánh lỗi, payload/param của service — Mockito, KHÔNG DB/Redis/Kafka/mạng |
| Integration | `*IT` | `./mvnw verify` (failsafe) | Truy vấn JPQL/native, ràng buộc CSDL, transaction — cần hạ tầng thật theo `.env` |

Báo cáo coverage (JaCoCo): `target/site/jacoco/index.html`.

## Bắt buộc khi xây mới / hiệu chỉnh

1. **Mỗi quy tắc nghiệp vụ một test** — bắt buộc nhập, không trùng, không cho xóa khi còn con, chuyển trạng thái
   hợp lệ, quyền… Test cả nhánh bị chặn (ném `BadRequestException` đúng câu) lẫn nhánh qua.
2. **Ràng buộc trả 400, không bao giờ 500**: dữ liệu người dùng nhập sai phải bị service chặn bằng
   `BadRequestException` câu tiếng Việt TRƯỚC khi chạm CSDL. Có unique index / check constraint thì kiểm ở service
   ĐÚNG phạm vi của ràng buộc đó (xem `pmis3-backend:pitfalls` #14–#15) và viết test cho cả trường hợp ràng buộc
   CSDL chặn mà kiểm cũ bỏ sót.
3. **Hiệu chỉnh hành vi**: sửa test cũ đang mô tả hành vi đó cho đúng hành vi mới — không xóa, không `@Disabled`.
4. **Sửa lỗi**: viết test tái hiện, chạy thấy ĐỎ, rồi mới sửa. Test ở lại vĩnh viễn.
5. Ràng buộc mới phải có test ở CẢ giao diện (nút khóa / dấu `*`) — báo phía frontend nếu không cùng người làm.
6. Chạy `./mvnw test` (thêm `./mvnw verify` khi có `*IT` liên quan) và báo kết quả thật.
7. Sửa xong muốn kiểm bằng API / e2e thì **khởi động lại service** — bean / class / field inject mới không
   hot-swap được, kiểm trên bản đang chạy cũ cho kết luận sai.

## Mẫu unit test service

```java
@ExtendWith(MockitoExtension.class)
class AAssetChangeCodeTest {

    @Mock AAssetRepository repository;
    @Mock AAssetCodeGuard codeGuard;
    // … @Mock cho MỌI dependency của constructor (@RequiredArgsConstructor) …
    @InjectMocks AAssetOperationService service;

    @ParameterizedTest(name = "mã mới = [{0}]")
    @NullSource
    @ValueSource(strings = {"", "   "})
    @DisplayName("Đổi mã thành trống → 'Mã thiết bị không được để trống.', không ghi gì")
    void changeToBlankIsRejected(String newCode) {
        assertThatThrownBy(() -> service.changeCode("ORG1", "A1", newCode, "lý do"))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Mã thiết bị không được để trống.");
        verify(repository, never()).save(any());
    }
}
```

- `@DisplayName` tiếng Việt mô tả hành vi + kết quả; `@ParameterizedTest` cho các giá trị biên.
- Phụ thuộc là component nhỏ không dùng state (vd guard kiểm hợp lệ) mà muốn chạy thật trong test của service:
  `doCallRealMethod().when(mock).method(any())`.
- Kiểm cả thứ KHÔNG được xảy ra: `verify(repository, never()).save(any())` khi bị chặn.
- Static (`SessionUtil`): `try (MockedStatic<SessionUtil> s = mockStatic(SessionUtil.class)) { … }`.
- Thêm dependency vào service → thêm `@Mock` tương ứng vào MỌI test dùng `@InjectMocks` service đó.

## Definition of Done (backend)

- [ ] Mỗi quy tắc nghiệp vụ mới/sửa có unit test (nhánh chặn + nhánh qua)
- [ ] Lỗi người dùng nhập trả 400 câu tiếng Việt; không còn đường nào để CSDL ném 500 cho dữ liệu đó
- [ ] Test cũ của hành vi bị đổi đã sửa theo; bug đã sửa có test tái hiện
- [ ] Thay đổi schema (index, constraint) có script trong `scripts/` — KHÔNG tự chạy lên DB dùng chung
- [ ] `./mvnw test` xanh (và `./mvnw verify` nếu có `*IT` liên quan), kết quả ghi vào PR
