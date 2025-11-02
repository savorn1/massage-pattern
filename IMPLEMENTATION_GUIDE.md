# 🚀 Enterprise Structure Implementation Guide

## Project Status: Foundation Complete ✅

This guide shows the enterprise-ready structure that has been prepared for your project with Admin, Client, and Vendor modules.

---

## ✅ What's Been Implemented

### 1. **Core Infrastructure** (Complete)

#### Role & Permission System
```typescript
// src/core/common/constants/roles.constant.ts
- ✅ UserRole enum (SUPER_ADMIN, ADMIN, CLIENT, VENDOR, GUEST)
- ✅ Permission enum (26 permissions)
- ✅ ROLE_PERMISSIONS mapping
- ✅ Helper functions (getPermissionsForRole, roleHasPermission)
```

#### Decorators
```typescript
// src/core/common/decorators/
- ✅ @Roles() - Role-based access
- ✅ @RequirePermissions() - Permission-based access
- ✅ @CurrentUser() - Get authenticated user
```

#### Guards
```typescript
// src/core/common/guards/
- ✅ JwtAuthGuard - JWT authentication
- ✅ RolesGuard - Role validation
- ✅ PermissionsGuard - Permission validation
```

#### Base Classes
```typescript
// src/core/database/base/
- ✅ BaseEntity - Common entity fields (audit trail, soft delete)
- ✅ BaseRepository - Common CRUD operations
```

---

## 📁 Directory Structure Created

```
src/
├── core/                          ✅ Complete
│   ├── common/
│   │   ├── constants/
│   │   │   └── roles.constant.ts  ✅ Roles & permissions
│   │   ├── decorators/
│   │   │   ├── roles.decorator.ts ✅
│   │   │   ├── permissions.decorator.ts ✅
│   │   │   └── current-user.decorator.ts ✅
│   │   └── guards/
│   │       ├── jwt-auth.guard.ts  ✅
│   │       ├── roles.guard.ts     ✅
│   │       └── permissions.guard.ts ✅
│   └── database/
│       └── base/
│           ├── base.entity.ts     ✅
│           └── base.repository.ts ✅
│
├── modules/                        ✅ Structure ready
│   ├── admin/                      📁 Ready for implementation
│   │   ├── users/
│   │   │   ├── controllers/
│   │   │   ├── services/
│   │   │   ├── dto/
│   │   │   │   └── create-user.dto.ts ✅ Example
│   │   │   └── entities/
│   │   │       └── user.entity.ts ✅ Example
│   │   ├── dashboard/
│   │   └── settings/
│   │
│   ├── client/                     📁 Ready for implementation
│   │   ├── profile/
│   │   ├── orders/
│   │   └── payments/
│   │
│   ├── vendor/                     📁 Ready for implementation
│   │   ├── profile/
│   │   ├── products/
│   │   └── analytics/
│   │
│   └── shared/                     📁 Ready for implementation
│       ├── auth/
│       ├── notifications/
│       └── uploads/
```

---

## 🎯 How to Use the New Structure

### Example 1: Admin Users Controller

```typescript
// src/modules/admin/users/controllers/admin-users.controller.ts
import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/core/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/core/common/guards/roles.guard';
import { PermissionsGuard } from '@/core/common/guards/permissions.guard';
import { Roles } from '@/core/common/decorators/roles.decorator';
import { RequirePermissions } from '@/core/common/decorators/permissions.decorator';
import { CurrentUser, UserContext } from '@/core/common/decorators/current-user.decorator';
import { UserRole, Permission } from '@/core/common/constants/roles.constant';
import { CreateUserDto } from '../dto/create-user.dto';
import { AdminUsersService } from '../services/admin-users.service';

@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminUsersController {
  constructor(private readonly usersService: AdminUsersService) {}

  @Post()
  @RequirePermissions(Permission.MANAGE_USERS)
  async create(@Body() dto: CreateUserDto, @CurrentUser() user: UserContext) {
    const newUser = await this.usersService.create(dto, user.id);
    return {
      success: true,
      data: newUser,
      message: 'User created successfully',
    };
  }

  @Get()
  @RequirePermissions(Permission.VIEW_ALL_USERS)
  async findAll() {
    const users = await this.usersService.findAll();
    return {
      success: true,
      data: users,
    };
  }

  @Get(':id')
  @RequirePermissions(Permission.VIEW_ALL_USERS)
  async findOne(@Param('id') id: string) {
    const user = await this.usersService.findById(id);
    return {
      success: true,
      data: user,
    };
  }
}
```

### Example 2: Client Orders Controller

```typescript
// src/modules/client/orders/controllers/client-orders.controller.ts
import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/core/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/core/common/guards/roles.guard';
import { Roles } from '@/core/common/decorators/roles.decorator';
import { RequirePermissions } from '@/core/common/decorators/permissions.decorator';
import { CurrentUser, UserContext } from '@/core/common/decorators/current-user.decorator';
import { UserRole, Permission } from '@/core/common/constants/roles.constant';
import { CreateOrderDto } from '../dto/create-order.dto';
import { ClientOrdersService } from '../services/client-orders.service';

@Controller('client/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CLIENT)
export class ClientOrdersController {
  constructor(private readonly ordersService: ClientOrdersService) {}

  @Post()
  @RequirePermissions(Permission.CREATE_ORDER)
  async create(@Body() dto: CreateOrderDto, @CurrentUser() user: UserContext) {
    const order = await this.ordersService.create(user.id, dto);
    return {
      success: true,
      data: order,
      message: 'Order created successfully',
    };
  }

  @Get()
  @RequirePermissions(Permission.VIEW_OWN_ORDERS)
  async getMyOrders(@CurrentUser() user: UserContext) {
    const orders = await this.ordersService.findByClientId(user.id);
    return {
      success: true,
      data: orders,
    };
  }
}
```

### Example 3: Vendor Products Controller

```typescript
// src/modules/vendor/products/controllers/vendor-products.controller.ts
import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '@/core/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/core/common/guards/roles.guard';
import { Roles } from '@/core/common/decorators/roles.decorator';
import { RequirePermissions } from '@/core/common/decorators/permissions.decorator';
import { CurrentUser, UserContext } from '@/core/common/decorators/current-user.decorator';
import { UserRole, Permission } from '@/core/common/constants/roles.constant';
import { CreateProductDto } from '../dto/create-product.dto';
import { VendorProductsService } from '../services/vendor-products.service';

@Controller('vendor/products')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.VENDOR)
export class VendorProductsController {
  constructor(private readonly productsService: VendorProductsService) {}

  @Post()
  @RequirePermissions(Permission.CREATE_PRODUCT)
  async create(@Body() dto: CreateProductDto, @CurrentUser() user: UserContext) {
    const product = await this.productsService.create(user.id, dto);
    return {
      success: true,
      data: product,
      message: 'Product created successfully',
    };
  }

  @Get()
  @RequirePermissions(Permission.MANAGE_PRODUCTS)
  async getMyProducts(@CurrentUser() user: UserContext) {
    const products = await this.productsService.findByVendorId(user.id);
    return {
      success: true,
      data: products,
    };
  }

  @Put(':id')
  @RequirePermissions(Permission.UPDATE_PRODUCT)
  async update(
    @Param('id') id: string,
    @Body() dto: any,
    @CurrentUser() user: UserContext,
  ) {
    const product = await this.productsService.update(id, user.id, dto);
    return {
      success: true,
      data: product,
      message: 'Product updated successfully',
    };
  }

  @Delete(':id')
  @RequirePermissions(Permission.DELETE_PRODUCT)
  async delete(@Param('id') id: string, @CurrentUser() user: UserContext) {
    await this.productsService.delete(id, user.id);
    return {
      success: true,
      message: 'Product deleted successfully',
    };
  }
}
```

### Example 4: Using Base Repository

```typescript
// src/modules/admin/users/services/users.repository.ts
import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BaseRepository } from '@/core/database/base/base.repository';
import { User, UserDocument } from '../entities/user.entity';

@Injectable()
export class UsersRepository extends BaseRepository<UserDocument> {
  constructor(@InjectModel(User.name) private userModel: Model<UserDocument>) {
    super(userModel);
  }

  // Add custom methods specific to User
  async findByEmail(email: string): Promise<UserDocument | null> {
    return this.findOne({ email, isDeleted: false });
  }

  async findActiveUsers(): Promise<UserDocument[]> {
    return this.findAll({ isActive: true, isDeleted: false });
  }

  async findByRole(role: string): Promise<UserDocument[]> {
    return this.findAll({ roles: role, isDeleted: false });
  }
}
```

### Example 5: Service with Base Repository

```typescript
// src/modules/admin/users/services/admin-users.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { BusinessException } from '@/core/exceptions/business.exception';
import { ErrorHandler } from '@/core/common/utils/error-handler.util';
import { CreateUserDto } from '../dto/create-user.dto';
import { UsersRepository } from './users.repository';

@Injectable()
export class AdminUsersService {
  private readonly logger = new Logger(AdminUsersService.name);

  constructor(private readonly usersRepository: UsersRepository) {}

  async create(dto: CreateUserDto, createdBy: string) {
    // Check for duplicate email
    const existing = await this.usersRepository.findByEmail(dto.email);
    if (existing) {
      throw BusinessException.duplicateResource('User', 'email');
    }

    // Create user with error handling
    return ErrorHandler.handleDatabaseOperation(
      () =>
        this.usersRepository.create({
          ...dto,
          roles: [dto.role],
          createdBy,
        }),
      'create',
      'users',
      this.logger,
    );
  }

  async findById(id: string) {
    const user = await this.usersRepository.findById(id);
    if (!user || user.isDeleted) {
      throw BusinessException.resourceNotFound('User', id);
    }
    return user;
  }

  async findAll() {
    return this.usersRepository.findAll({ isDeleted: false });
  }
}
```

---

## 🔐 Permission Matrix

### Admin Permissions

| Permission | Super Admin | Admin | Description |
|------------|-------------|-------|-------------|
| `MANAGE_USERS` | ✅ | ❌ | Create, update, delete users |
| `VIEW_ALL_USERS` | ✅ | ✅ | View all users in system |
| `DELETE_USERS` | ✅ | ❌ | Delete user accounts |
| `VIEW_ANALYTICS` | ✅ | ✅ | View system analytics |
| `MANAGE_SETTINGS` | ✅ | ✅ | Manage system settings |
| `MANAGE_SYSTEM` | ✅ | ❌ | Full system control |

### Client Permissions

| Permission | Description |
|------------|-------------|
| `CREATE_ORDER` | Create new orders |
| `VIEW_OWN_ORDERS` | View own order history |
| `CANCEL_ORDER` | Cancel pending orders |
| `MAKE_PAYMENT` | Process payments |
| `VIEW_PAYMENT_HISTORY` | View payment history |

### Vendor Permissions

| Permission | Description |
|------------|-------------|
| `MANAGE_PRODUCTS` | Full product management |
| `CREATE_PRODUCT` | Add new products |
| `UPDATE_PRODUCT` | Update existing products |
| `DELETE_PRODUCT` | Remove products |
| `VIEW_SALES` | View sales data |
| `MANAGE_INVENTORY` | Manage stock levels |
| `VIEW_VENDOR_ANALYTICS` | View vendor analytics |

### Shared Permissions

| Permission | All Roles |
|------------|-----------|
| `UPDATE_PROFILE` | ✅ |
| `VIEW_PROFILE` | ✅ |
| `VIEW_NOTIFICATIONS` | ✅ |

---

## 📦 Module Implementation Pattern

For each new feature, follow this pattern:

```
feature-name/
├── controllers/
│   └── feature.controller.ts       # HTTP routes
├── services/
│   ├── feature.service.ts          # Business logic
│   └── feature.repository.ts       # Data access (extends BaseRepository)
├── dto/
│   ├── create-feature.dto.ts       # Create validation
│   ├── update-feature.dto.ts       # Update validation
│   └── query-feature.dto.ts        # Query filters
├── entities/
│   └── feature.entity.ts           # Entity (extends BaseEntity)
└── feature.module.ts               # Module definition
```

---

## 🚀 Next Steps

### Phase 1: Implement Authentication (High Priority)

1. **Install dependencies**:
   ```bash
   npm install @nestjs/jwt @nestjs/passport passport passport-jwt bcrypt
   npm install -D @types/passport-jwt @types/bcrypt
   ```

2. **Create auth module**:
   ```
   src/modules/shared/auth/
   ├── strategies/jwt.strategy.ts
   ├── services/auth.service.ts
   ├── services/password.service.ts
   └── auth.module.ts
   ```

### Phase 2: Implement Core Modules

1. **Admin Module** - User management, dashboard
2. **Client Module** - Profile, orders, payments
3. **Vendor Module** - Profile, products, analytics

### Phase 3: Add Shared Services

1. **Notifications** - Email, SMS, push notifications
2. **Uploads** - File upload and management
3. **Audit Logging** - Track user actions

### Phase 4: Testing & Documentation

1. Write unit tests for services
2. Write integration tests for controllers
3. Write E2E tests for complete flows
4. Generate API documentation

---

## 💡 Best Practices

### 1. Always Use Guards

```typescript
// ❌ Bad - No authentication
@Controller('admin/users')
export class AdminUsersController {}

// ✅ Good - Proper authentication and authorization
@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
export class AdminUsersController {}
```

### 2. Use CurrentUser Decorator

```typescript
// ❌ Bad - Accessing request directly
async create(@Req() request: Request) {
  const userId = request.user.id;
}

// ✅ Good - Using decorator
async create(@CurrentUser() user: UserContext) {
  const userId = user.id;
}
```

### 3. Implement Repository Pattern

```typescript
// ❌ Bad - Direct model access in service
@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}
}

// ✅ Good - Using repository
@Injectable()
export class UsersService {
  constructor(private usersRepository: UsersRepository) {}
}
```

### 4. Use Error Handler Utilities

```typescript
// ❌ Bad - Raw try-catch
try {
  return await this.model.create(data);
} catch (error) {
  throw error;
}

// ✅ Good - Using ErrorHandler
return ErrorHandler.handleDatabaseOperation(
  () => this.repository.create(data),
  'create',
  'users',
  this.logger,
);
```

---

## 📊 Current vs New Structure

### Before (Educational)
```
src/
├── messaging/          # Messaging patterns
├── persistence/        # Data layer
└── integrations/       # Examples
```

### After (Enterprise-Ready)
```
src/
├── core/               # ✅ Shared infrastructure
├── modules/            # ✅ Feature modules by user type
│   ├── admin/          # ✅ Admin features
│   ├── client/         # ✅ Client features
│   ├── vendor/         # ✅ Vendor features
│   └── shared/         # ✅ Shared features
├── messaging/          # ✅ Keep existing patterns
├── persistence/        # ✅ Keep existing MongoDB
└── config/             # ✅ Configuration
```

---

## ✅ Ready to Build!

The foundation is complete. You now have:

- ✅ Role-based access control
- ✅ Permission system
- ✅ Base classes for entities and repositories
- ✅ Guards and decorators
- ✅ Module structure
- ✅ Example implementations
- ✅ Best practices documented

Start implementing features using the examples provided!

---

**Related Documentation:**
- [ENTERPRISE_STRUCTURE.md](./ENTERPRISE_STRUCTURE.md) - Complete guide
- [ARCHITECTURE_COMPARISON.md](./ARCHITECTURE_COMPARISON.md) - Decision guide
- [ERROR_HANDLING.md](./ERROR_HANDLING.md) - Error handling
- [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md) - Current structure

**Last Updated:** 2025-11-01
