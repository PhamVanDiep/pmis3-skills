---
name: code-style
description: 'Quy định style code BẮT BUỘC của mọi backend PMIS3: thụt lề 4 dấu cách, dòng tối đa 120 ký tự, Spotless (palantir-java-format) + maven-checkstyle-plugin chạy ở phase verify và ở CI. Kèm checkstyle.xml gốc, đoạn pom, bước CI và cách cài cho repo chưa có. Đọc khi viết/sửa code Java, khi build/CI báo lỗi spotless hoặc checkstyle, hoặc khi cài style check cho một microservice.'
---

# Style code backend PMIS3

Mọi microservice backend PMIS3 dùng chung **một** bộ quy định style. Code sai style thì `./mvnw verify` /
`./mvnw install` và pipeline CI **đều fail**, nên chưa sửa style thì chưa xong việc.

## Quy định

| Quy tắc | Giá trị |
|---|---|
| Thụt lề | **4 dấu cách**, không dùng tab. Xuống dòng tiếp nối thụt 8 |
| Độ dài dòng | tối đa **120** ký tự. Riêng dòng chỉ chứa chuỗi (mô tả Swagger, thông báo) được vượt quá |
| Định dạng | `palantir-java-format` qua Spotless: bỏ import thừa, sắp xếp import, xóa khoảng trắng cuối dòng, có dòng trống cuối file |
| Khối lệnh | `if/for/while` nhiều dòng phải có `{}`. Lệnh ngắn cùng dòng được bỏ `{}`: `if (x == null) return;` |
| Đặt tên | package chữ thường; class/interface/enum `PascalCase`; method, field, biến, tham số, lambda dạng `camelCase`; hằng `static final` dạng `HOA_GACH_DUOI` (riêng logger được viết `log`/`logger`); generic là 1 chữ hoa (`T`, `K`); trong tên không quá 4 chữ hoa liền nhau (`ORGID` được, `getHTTPURL` không) |
| Khai báo | mỗi biến một câu lệnh, `long` ghi hậu tố `L` hoa, khai báo mảng kiểu Java (`String[] a`) |
| Lỗi dễ mắc | `equals` đi kèm `hashCode`, không so chuỗi bằng `==`, `switch` có `default` |
| `import *` | được phép, vì IntelliJ tự gộp import |

**Thụt lề do Spotless đảm bảo**, Checkstyle không kiểm. Module `Indentation` của Checkstyle hiểu thụt lề
khác palantir (switch-case dạng `->`, lambda lồng trong chuỗi gọi), nên **không bật** nó.

## Làm hằng ngày

```bash
./mvnw spotless:apply                        # tự format toàn bộ code (chạy trước khi commit)
./mvnw spotless:check checkstyle:check       # chỉ kiểm style, nhanh
./mvnw verify                                # build + test + kiểm style (giống CI)
```

- Sau khi sửa code: chạy `./mvnw spotless:apply`, sau đó `./mvnw spotless:check checkstyle:check` phải xanh.
- Checkstyle báo lỗi thì **sửa code**, không nới `checkstyle.xml` của riêng một repo. Muốn đổi quy tắc thì sửa
  bản gốc trong skill này, rồi chép sang mọi repo.
- Chuỗi tiếng Việt dài trong `@Operation(description = ...)` không cần cắt. Comment/Javadoc quá 120 ký tự
  thì phải ngắt dòng.
- `./mvnw test` **không** chạy style check (gắn ở phase `verify`), nên đang viết dở vẫn chạy test được.
- IntelliJ: cài plugin *palantir-java-format* để format trong IDE giống CI. Tối thiểu cũng phải để
  Code Style → Java → Tab size / Indent = 4, Continuation indent = 8, Hard wrap at = 120. `.editorconfig` ở gốc
  repo đã khai báo sẵn các giá trị này.

## Cài cho một repo backend chưa có

1. Chép [`checkstyle.xml`](checkstyle.xml) và [`editorconfig`](editorconfig) (đổi tên thành `.editorconfig`)
   của skill này vào gốc repo.
2. Thêm vào `pom.xml`:

```xml
<properties>
    <!-- Kiểm tra style code (quy định chung PMIS3): thụt lề 4 dấu cách, dòng tối đa 120 ký tự. -->
    <spotless.version>3.10.4</spotless.version>
    <palantir-java-format.version>2.102.0</palantir-java-format.version>
    <maven-checkstyle-plugin.version>3.6.0</maven-checkstyle-plugin.version>
    <!-- Checkstyle 13+ cần Java 21; CI chạy JDK 17 nên giữ nhánh 12.x. -->
    <checkstyle.version>12.3.1</checkstyle.version>
</properties>

<build>
    <plugins>
        <!-- Định dạng code: `./mvnw spotless:apply` để tự sửa, `spotless:check` chạy ở phase verify (CI chặn). -->
        <plugin>
            <groupId>com.diffplug.spotless</groupId>
            <artifactId>spotless-maven-plugin</artifactId>
            <version>${spotless.version}</version>
            <configuration>
                <java>
                    <includes>
                        <include>src/main/java/**/*.java</include>
                        <include>src/test/java/**/*.java</include>
                    </includes>
                    <palantirJavaFormat>
                        <version>${palantir-java-format.version}</version>
                        <style>PALANTIR</style>
                    </palantirJavaFormat>
                    <removeUnusedImports/>
                    <importOrder/>
                    <trimTrailingWhitespace/>
                    <endWithNewline/>
                </java>
            </configuration>
            <executions>
                <execution>
                    <id>spotless-check</id>
                    <phase>verify</phase>
                    <goals>
                        <goal>check</goal>
                    </goals>
                </execution>
            </executions>
        </plugin>
        <!-- Quy tắc style: checkstyle.xml ở gốc repo, chạy ở phase verify, có vi phạm là build lỗi. -->
        <plugin>
            <groupId>org.apache.maven.plugins</groupId>
            <artifactId>maven-checkstyle-plugin</artifactId>
            <version>${maven-checkstyle-plugin.version}</version>
            <dependencies>
                <dependency>
                    <groupId>com.puppycrawl.tools</groupId>
                    <artifactId>checkstyle</artifactId>
                    <version>${checkstyle.version}</version>
                </dependency>
            </dependencies>
            <configuration>
                <configLocation>checkstyle.xml</configLocation>
                <consoleOutput>true</consoleOutput>
                <failOnViolation>true</failOnViolation>
                <violationSeverity>warning</violationSeverity>
                <includeTestSourceDirectory>true</includeTestSourceDirectory>
            </configuration>
            <executions>
                <execution>
                    <id>checkstyle-check</id>
                    <phase>verify</phase>
                    <goals>
                        <goal>check</goal>
                    </goals>
                </execution>
            </executions>
        </plugin>
    </plugins>
</build>
```

3. Thêm bước vào `azure-pipelines.yml`, **sau** `JavaToolInstaller` và **trước** bước build:

```yaml
  # Kiểm tra style code (quy định chung PMIS3): sai định dạng / vi phạm checkstyle là dừng pipeline.
  # Sửa ở máy: ./mvnw spotless:apply rồi commit lại.
  - script: |
      ./mvnw -B spotless:check checkstyle:check
    displayName: 'Style check (Spotless + Checkstyle)'
```

   Bước `clean install` (kể cả khi có `-DskipTests`) cũng chạy lại hai bước check này vì chúng gắn ở phase `verify`.

4. Chạy `./mvnw spotless:apply`, sau đó `./mvnw checkstyle:check`, rồi sửa tay các lỗi còn lại (thường là thiếu
   `{}` trong `if` nhiều dòng, comment quá 120 ký tự, khai báo nhiều biến trên một dòng, tab trong header comment).
5. Chạy `./mvnw clean verify` bằng **JDK 17** (giống CI): phải `BUILD SUCCESS`, `0 Checkstyle violations`.
6. Commit lần format toàn bộ **riêng một commit** (vd `style: áp dụng Spotless + Checkstyle`), tách khỏi commit
   đổi nghiệp vụ, để review và `git blame` dễ đọc. Có thể ghi mã commit đó vào `.git-blame-ignore-revs`.

## Bẫy

- **Phiên bản Checkstyle**: bản 13.x trở lên được biên dịch cho Java 21, chạy trên JDK 17 của CI sẽ báo
  `UnsupportedClassVersionError ... class file version 65.0`. Giữ nhánh 12.x cho tới khi CI lên JDK 21.
- **Kiểm bằng JDK 17**: máy dev có thể đang chạy JDK 19/21, nên trước khi báo xong thì đặt
  `JAVA_HOME` về JDK 17 rồi chạy lại `./mvnw verify`.
- **Xuống dòng CRLF/LF**: Spotless theo `core.autocrlf` của git, không ép LF, nên `.editorconfig` không khai
  báo `end_of_line`.
- **Text block JPQL** (`"""`) không được formatter ngắt dòng. Dòng nào quá 120 ký tự thì tự xuống dòng trong
  câu query.
