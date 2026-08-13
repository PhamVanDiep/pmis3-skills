---
name: notification
description: 'Gửi thông báo trong backend PMIS3: entity SNotify, NotificationWebhookClient, sự kiện WebSocket, mẫu thông báo tiếng Việt.'
---

# PMIS3 Notification System

## Overview

The notification system uses `SNotify` and `SNotifyUser` entities with WebSocket for real-time delivery.

## Entities

- **SNotify**: Stores notification content
  - `id` (Long, auto-generated)
  - `content` (String, max 500) - Notification message
  - `url` (String, max 500) - Optional navigation URL
  - `type` (Short) - 1: Normal, 2: System
  - `userCrId`, `userCrDtime` - Creator info

- **SNotifyUser**: Maps notifications to users
  - Composite key: `userid` + `ntfid`
  - `read` (Boolean) - Read status

## Sending Notifications

### Using NotificationWebhookClient

```java
// Inject in service
private final NotificationWebhookClient notificationClient;

// Send to SUPER_ADMIN users
notificationClient.sendToSuperAdmins(
    "Khu vực mới 'Site A' đã được tạo thành công",
    "/sites?siteid=SITE_A"
);

// Send to specific users
notificationClient.sendToUsers(
    "Nội dung thông báo",
    "/link/to/resource",
    (short) 1, // type: 1=normal, 2=system
    List.of("user1", "user2")
);

// Send to roles
notificationClient.sendToRoles(
    "Nội dung thông báo",
    "/link/to/resource",
    (short) 1,
    List.of("ROLE_ADMIN", "ROLE_USER")
);

// Broadcast to all users
notificationClient.broadcast(
    "Hệ thống sẽ bảo trì vào 22:00",
    null
);
```

### Using SNotifyService

```java
// Send to SUPER_ADMIN users
notifyService.createAndSendToSuperAdmins(
    "Người dùng mới 'admin' đã được tạo thành công",
    "/users/admin"
);

// Send to users with specific roles
notifyService.createAndSendToRoles(
    "Nội dung thông báo",
    "/link/to/resource",
    SNotifyService.TYPE_NORMAL,
    List.of("ROLE_SUPER_ADMIN", "ROLE_ADMIN")
);

// Send to specific users
notifyService.createAndSendToUsers(
    "Nội dung thông báo",
    "/link/to/resource",
    SNotifyService.TYPE_NORMAL,
    List.of("user1", "user2")
);

// Broadcast system notification
notifyService.createSystemNotification(
    "Hệ thống sẽ bảo trì vào 22:00 hôm nay",
    null
);
```

## WebSocket Events

- `NEW_NOTIFICATION` - New notification received
- `NOTIFICATION_READ` - Single notification marked as read
- `ALL_NOTIFICATIONS_READ` - All notifications marked as read

## Important Rules

1. **All notification messages MUST be written in Vietnamese** - This is a user-facing system for Vietnamese users
2. **Use clear, professional Vietnamese** - Avoid slang or informal language
3. **Include context in messages** - e.g., "Nguoi dung 'admin' da duoc tao" instead of just "Tao thanh cong"
4. **Provide actionable URLs** - Link to the relevant resource when applicable
5. **No `orgid` header required** - Notifications are personal to each user

## Message Templates

| Action | Message Template |
|--------|------------------|
| User created | `Người dùng mới '{userid}' đã được tạo thành công` |
| User updated | `Thông tin người dùng '{userid}' đã được cập nhật` |
| User deleted | `Người dùng '{userid}' đã bị xóa` |
| Role assigned | `Vai trò '{rolename}' đã được gán cho người dùng '{userid}'` |
| Password changed | `Mật khẩu của bạn đã được thay đổi thành công` |
| System maintenance | `Hệ thống sẽ bảo trì vào {time}` |
| Task assigned | `Bạn có công việc mới: {taskname}` |
| Approval needed | `Yêu cầu phê duyệt: {requestname}` |
