---
name: commands
description: 'Tra nhanh lệnh build, test, run của backend PMIS3 (Maven, Spring Boot, Swagger UI).'
---

> **Tham số theo repo** — thay các placeholder dưới đây bằng giá trị của **repo hiện tại**,
> đọc ở `CLAUDE.md` tại gốc repo (hoặc `application.yml` / `pom.xml`):
>
> | Placeholder | Ý nghĩa | Ví dụ |
> |---|---|---|
> | `{module}` | hậu tố module, cũng là tên thư mục con trong `entity/`, `dto/`, `repository/`, `service/` | `quantri`, `sxd`, `vattu`, `thietbi` |
> | `{Module}` | dạng PascalCase của `{module}` | `Quantri`, `Sxd` |
> | `{PORT}` | cổng service | `9000`, `8998` |
>
> KHÔNG hard-code giá trị của một module cụ thể — mỗi microservice một khác.

# PMIS3 Development Commands

## Build and Run

```bash
# Build the project
./mvnw clean install

# Run the application
./mvnw spring-boot:run

# Run with specific profile
./mvnw spring-boot:run -Dspring-boot.run.profiles=dev

# Package as JAR
./mvnw clean package
```

## Testing

```bash
# Run all tests
./mvnw test

# Run specific test class
./mvnw test -Dtest=YourTestClass

# Run specific test method
./mvnw test -Dtest=YourTestClass#testMethod
```

## Docker Services

```bash
# Start Gotenberg PDF service (required for PDF generation)
docker-compose up -d

# Stop services
docker-compose down
```

## Code Quality

```bash
# Compile and check for errors
./mvnw compile

# Verify project (runs tests and checks)
./mvnw verify
```

## Server Info

- **Port**: {PORT} (configurable via `SERVER_PORT`)
- **Context Path**: `/pmis3-nguon-{module}/v1`
- **Swagger UI**: http://localhost:{PORT}/pmis3-nguon-{module}/v1/swagger-ui.html
- **OpenAPI JSON**: http://localhost:{PORT}/pmis3-nguon-{module}/v1/v3/api-docs
