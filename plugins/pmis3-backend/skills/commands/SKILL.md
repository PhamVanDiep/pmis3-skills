---
name: commands
description: 'Tra nhanh lệnh build, test, run của backend PMIS3 (Maven, Spring Boot, Swagger UI).'
---

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

- **Port**: 9000 (configurable via `SERVER_PORT`)
- **Context Path**: `/pmis3-nguon-quantri/v1`
- **Swagger UI**: http://localhost:9000/pmis3-nguon-quantri/v1/swagger-ui.html
- **OpenAPI JSON**: http://localhost:9000/pmis3-nguon-quantri/v1/v3/api-docs
