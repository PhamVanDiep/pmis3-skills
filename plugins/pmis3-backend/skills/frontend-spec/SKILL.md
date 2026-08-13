---
name: frontend-spec
description: 'Sinh tài liệu đặc tả frontend (SPEC) từ module backend PMIS3 để frontend dựng màn hình theo. Dùng sau khi hoàn thành API backend.'
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

# Generate Frontend Specification Document

When invoked, create a comprehensive spec document in `../pmis3-nguon-frontend/docs/FE_{MODULE}_SPEC.md` for the specified module.

## Output Location

- **Path**: `../pmis3-nguon-frontend/docs/FE_{MODULE}_SPEC.md`
- The frontend repo (`pmis3-nguon-frontend`) is a sibling directory to the backend repo (`pmis3-nguon-backend-{module}`) under `D:\SourceCode\PMIS3\PMIS3-NGUON\`
- Always write docs directly to the frontend `docs/` folder, not the backend
- When building a new CRUD module, auto-generate this spec alongside the backend code

## Required Sections (8 sections)

1. **Tổng quan** - Overview of the module and authentication requirements
2. **Data Model** - TypeScript interfaces for DTOs and API responses
3. **API Endpoints** - Detailed documentation for each endpoint:
   - Endpoint URL with HTTP method
   - Headers required (including `orgid`)
   - Query/Request parameters (always `@RequestParam`, never `@PathVariable`)
   - Request/Response examples (JSON)
   - Validation rules
   - Error responses
   - UI suggestions (Gợi ý UI - brief suggestions per endpoint)
4. **User Flow** - Step-by-step flows for:
   - Create operation
   - Update operation
   - Delete operation
5. **Error Handling** - Client-side validation and server-side error handling with TypeScript code examples
6. **State Management** - Suggested store structure (Redux/Vuex/Pinia) with TypeScript interfaces
7. **Security & Performance** - Token management, input sanitization, XSS prevention, lazy loading, caching, debouncing, optimization tips
8. **Testing Checklist** - **Only Functional Testing items** (checkbox list format)

## DO NOT Include

- Wireframe Gợi ý section (ASCII art wireframes)
- Sample Code section (React/Vue examples)
- Notes & Tips section
- Contact & Support section
- UI/UX Testing checklist
- Security Testing checklist

## Important Rules

- All API examples must use `@RequestParam` (not `@PathVariable`)
- Include TypeScript interfaces for all data models
- All messages in Vietnamese
- Focus on API contract and business flows
- Keep brief "Gợi ý UI" in each API endpoint (not a separate section)
- Base URL: `/pmis3-nguon-{module}/v1`
- All endpoints require `Authorization: Bearer <token>` header
- Most endpoints require `orgid` header
