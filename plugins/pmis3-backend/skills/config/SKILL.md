---
name: config
description: 'Cấu hình backend PMIS3: biến môi trường, dịch vụ Docker, Gotenberg, tích hợp EVNID.'
---

# PMIS3 Configuration & Environment

## Required Environment Variables

```bash
# Database
DB_URL=jdbc:sqlserver://10.0.40.126;database=PMIS_UPGRADE
DB_USERNAME=your_username
DB_PASSWORD=your_password

# JWT Keys (consumed by the library's RSAKeyConfig -> app.jwt.public-key/private-key)
JWT_PUBLIC_KEY=your_rsa_public_key
JWT_PRIVATE_KEY=your_rsa_private_key

# Redis (required by the library for permission cache + pub/sub invalidation)
REDIS_HOST=localhost
REDIS_PORT=6379

# AES Encryption (optional, defaults provided)
AES_PASSWORD=your_aes_password
AES_SALT=your_aes_salt

# Server (optional)
SERVER_PORT=9000
CORS_ORIGINS=*

# Features (optional)
SWAGGER_ENABLED=true
```

## Shared Library Configuration (`pmis.security.*` / `pmis.web.*`)

The starter `pmis3-security-starter` reads these from `application.yml`:

```yaml
pmis:
  security:
    context-path: ${server.servlet.context-path}   # stripped before endpoint lookup
    white-list:                                     # public endpoints (skip function interceptor)
      - error
      - auth/login
      - swagger-ui
      - v3/api-docs
      - actuator/health
    # jwt-white-list: [ ... ]    # (optional) ant-patterns skipping JwtAuthenticationFilter
    cache:
      enabled: true              # Redis cache + pub/sub invalidation; set false if no Redis
      # evict-channel: pmis:perm:evict
    # dto-enrichment: { enabled: true }
  # web:                         # all default true; override to disable a feature
    # advice: { enabled: true }
    # cors: { enabled: true }
    # swagger: { enabled: true }
    # rest-template: { enabled: true, connect-timeout: 5000, read-timeout: 30000 }
```

`app.jwt.*` (header, header-prefix, expiration, public-key, private-key) and `app.cookie.*` are **required** by the library's JWT filter / `CookieUtil`.

## Configuration Files

- **application.yml**: Main configuration (committed to repo)
- **application-dev.yml**: Development overrides (if needed)
- **application-prod.yml**: Production overrides (if needed)

Use Spring profiles: `--spring.profiles.active=dev`

## Swagger/OpenAPI Documentation

- **Swagger UI**: http://localhost:9000/pmis3-nguon-quantri/v1/swagger-ui.html
- **OpenAPI JSON**: http://localhost:9000/pmis3-nguon-quantri/v1/v3/api-docs

## External Integrations

### Gotenberg PDF Service

- **Purpose**: PDF generation from HTML
- **Endpoint**: http://localhost:3000
- **Start**: `docker-compose up -d`
- **Docker Image**: gotenberg/gotenberg:8

### EVNID Integration

For external authentication with EVNID:
- Configure `SEvnidCfg` entity with organization-specific settings
- API endpoints: login, logout, refresh
- Use `QUser.authenType` to identify authentication method

## Development Workflow

1. **Start database and services**: Ensure SQL Server is accessible and `docker-compose up -d`
2. **Implement repository layer**: Create Spring Data JPA repositories
3. **Implement service layer**: Business logic with proper authorization checks
4. **Implement controller layer**: REST endpoints with DTO mapping
5. **Configure Spring Security**: JWT filters, authentication providers
6. **Add tests**: Unit tests for services, integration tests for controllers
7. **Document APIs**: Add Swagger annotations
8. **Test with Swagger UI**: Verify endpoints at http://localhost:9000/pmis3-nguon-quantri/v1/swagger-ui.html
