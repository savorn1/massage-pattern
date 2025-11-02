# 🏢 Enterprise Project Structure Guide

## Multi-Tenant Architecture (Admin, Client, Vendor)

This guide provides a comprehensive structure for large-scale applications with multiple user types and complex business logic.

---

## 📚 Table of Contents

- [Architecture Overview](#architecture-overview)
- [Directory Structure](#directory-structure)
- [Module Organization](#module-organization)
- [Authentication & Authorization](#authentication--authorization)
- [Best Practices](#best-practices)
- [Scalability Patterns](#scalability-patterns)
- [Example Implementation](#example-implementation)

---

## Architecture Overview

### Core Principles

1. **Domain-Driven Design (DDD)** - Organize by business domains
2. **Separation of Concerns** - Clear boundaries between layers
3. **Multi-Tenancy** - Support for multiple user roles (Admin, Client, Vendor)
4. **Modularity** - Independent, reusable modules
5. **Scalability** - Horizontal and vertical scaling support

### Architecture Layers

```
┌─────────────────────────────────────────┐
│         Presentation Layer              │
│  (Controllers, Gateways, DTOs)          │
├─────────────────────────────────────────┤
│         Application Layer               │
│  (Use Cases, Services, Orchestration)   │
├─────────────────────────────────────────┤
│         Domain Layer                    │
│  (Entities, Value Objects, Rules)       │
├─────────────────────────────────────────┤
│         Infrastructure Layer            │
│  (Database, External APIs, Messaging)   │
└─────────────────────────────────────────┘
```

---

## Directory Structure

### Complete Project Structure

```
enterprise-app/
├── src/
│   ├── core/                          # Shared core functionality
│   │   ├── common/
│   │   │   ├── constants/
│   │   │   │   ├── roles.constant.ts
│   │   │   │   ├── permissions.constant.ts
│   │   │   │   └── status.constant.ts
│   │   │   ├── decorators/
│   │   │   │   ├── roles.decorator.ts
│   │   │   │   ├── permissions.decorator.ts
│   │   │   │   └── current-user.decorator.ts
│   │   │   ├── guards/
│   │   │   │   ├── jwt-auth.guard.ts
│   │   │   │   ├── roles.guard.ts
│   │   │   │   └── permissions.guard.ts
│   │   │   ├── interceptors/
│   │   │   │   ├── logging.interceptor.ts
│   │   │   │   ├── transform.interceptor.ts
│   │   │   │   └── timeout.interceptor.ts
│   │   │   ├── pipes/
│   │   │   │   ├── parse-object-id.pipe.ts
│   │   │   │   └── trim.pipe.ts
│   │   │   └── utils/
│   │   │       ├── pagination.util.ts
│   │   │       ├── date.util.ts
│   │   │       └── crypto.util.ts
│   │   │
│   │   ├── database/
│   │   │   ├── base/
│   │   │   │   ├── base.entity.ts
│   │   │   │   ├── base.repository.ts
│   │   │   │   └── base.service.ts
│   │   │   ├── migrations/
│   │   │   │   └── *.migration.ts
│   │   │   └── seeds/
│   │   │       └── *.seed.ts
│   │   │
│   │   ├── exceptions/
│   │   │   ├── http-exception.filter.ts
│   │   │   ├── business.exception.ts
│   │   │   ├── auth.exception.ts
│   │   │   └── validation.exception.ts
│   │   │
│   │   └── interfaces/
│   │       ├── api-response.interface.ts
│   │       ├── pagination.interface.ts
│   │       └── user-context.interface.ts
│   │
│   ├── modules/                       # Business modules by user type
│   │   ├── admin/
│   │   │   ├── users/
│   │   │   │   ├── controllers/
│   │   │   │   │   └── admin-users.controller.ts
│   │   │   │   ├── services/
│   │   │   │   │   ├── admin-users.service.ts
│   │   │   │   │   └── user-management.service.ts
│   │   │   │   ├── dto/
│   │   │   │   │   ├── create-user.dto.ts
│   │   │   │   │   ├── update-user.dto.ts
│   │   │   │   │   └── query-user.dto.ts
│   │   │   │   ├── entities/
│   │   │   │   │   └── admin-user.entity.ts
│   │   │   │   └── admin-users.module.ts
│   │   │   │
│   │   │   ├── dashboard/
│   │   │   │   ├── controllers/
│   │   │   │   │   └── admin-dashboard.controller.ts
│   │   │   │   ├── services/
│   │   │   │   │   ├── analytics.service.ts
│   │   │   │   │   ├── reports.service.ts
│   │   │   │   │   └── metrics.service.ts
│   │   │   │   ├── dto/
│   │   │   │   │   ├── analytics-query.dto.ts
│   │   │   │   │   └── report-filter.dto.ts
│   │   │   │   └── admin-dashboard.module.ts
│   │   │   │
│   │   │   ├── settings/
│   │   │   │   ├── controllers/
│   │   │   │   │   └── admin-settings.controller.ts
│   │   │   │   ├── services/
│   │   │   │   │   ├── system-config.service.ts
│   │   │   │   │   └── feature-flags.service.ts
│   │   │   │   ├── entities/
│   │   │   │   │   └── system-setting.entity.ts
│   │   │   │   └── admin-settings.module.ts
│   │   │   │
│   │   │   └── admin.module.ts
│   │   │
│   │   ├── client/
│   │   │   ├── profile/
│   │   │   │   ├── controllers/
│   │   │   │   │   └── client-profile.controller.ts
│   │   │   │   ├── services/
│   │   │   │   │   ├── client-profile.service.ts
│   │   │   │   │   └── preferences.service.ts
│   │   │   │   ├── dto/
│   │   │   │   │   ├── update-profile.dto.ts
│   │   │   │   │   └── update-preferences.dto.ts
│   │   │   │   ├── entities/
│   │   │   │   │   ├── client.entity.ts
│   │   │   │   │   └── client-preference.entity.ts
│   │   │   │   └── client-profile.module.ts
│   │   │   │
│   │   │   ├── orders/
│   │   │   │   ├── controllers/
│   │   │   │   │   └── client-orders.controller.ts
│   │   │   │   ├── services/
│   │   │   │   │   ├── order-management.service.ts
│   │   │   │   │   └── order-tracking.service.ts
│   │   │   │   ├── dto/
│   │   │   │   │   ├── create-order.dto.ts
│   │   │   │   │   └── query-order.dto.ts
│   │   │   │   ├── entities/
│   │   │   │   │   ├── order.entity.ts
│   │   │   │   │   └── order-item.entity.ts
│   │   │   │   └── client-orders.module.ts
│   │   │   │
│   │   │   ├── payments/
│   │   │   │   ├── controllers/
│   │   │   │   │   └── client-payments.controller.ts
│   │   │   │   ├── services/
│   │   │   │   │   ├── payment-processing.service.ts
│   │   │   │   │   └── invoice.service.ts
│   │   │   │   ├── dto/
│   │   │   │   │   └── process-payment.dto.ts
│   │   │   │   ├── entities/
│   │   │   │   │   ├── payment.entity.ts
│   │   │   │   │   └── invoice.entity.ts
│   │   │   │   └── client-payments.module.ts
│   │   │   │
│   │   │   └── client.module.ts
│   │   │
│   │   ├── vendor/
│   │   │   ├── profile/
│   │   │   │   ├── controllers/
│   │   │   │   │   └── vendor-profile.controller.ts
│   │   │   │   ├── services/
│   │   │   │   │   ├── vendor-profile.service.ts
│   │   │   │   │   └── vendor-verification.service.ts
│   │   │   │   ├── dto/
│   │   │   │   │   ├── update-vendor-profile.dto.ts
│   │   │   │   │   └── vendor-verification.dto.ts
│   │   │   │   ├── entities/
│   │   │   │   │   └── vendor.entity.ts
│   │   │   │   └── vendor-profile.module.ts
│   │   │   │
│   │   │   ├── products/
│   │   │   │   ├── controllers/
│   │   │   │   │   └── vendor-products.controller.ts
│   │   │   │   ├── services/
│   │   │   │   │   ├── product-management.service.ts
│   │   │   │   │   └── inventory.service.ts
│   │   │   │   ├── dto/
│   │   │   │   │   ├── create-product.dto.ts
│   │   │   │   │   ├── update-product.dto.ts
│   │   │   │   │   └── update-inventory.dto.ts
│   │   │   │   ├── entities/
│   │   │   │   │   ├── product.entity.ts
│   │   │   │   │   └── inventory.entity.ts
│   │   │   │   └── vendor-products.module.ts
│   │   │   │
│   │   │   ├── analytics/
│   │   │   │   ├── controllers/
│   │   │   │   │   └── vendor-analytics.controller.ts
│   │   │   │   ├── services/
│   │   │   │   │   ├── sales-analytics.service.ts
│   │   │   │   │   └── performance.service.ts
│   │   │   │   └── vendor-analytics.module.ts
│   │   │   │
│   │   │   └── vendor.module.ts
│   │   │
│   │   └── shared/                    # Shared between user types
│   │       ├── auth/
│   │       │   ├── controllers/
│   │       │   │   └── auth.controller.ts
│   │       │   ├── services/
│   │       │   │   ├── auth.service.ts
│   │       │   │   ├── jwt.service.ts
│   │       │   │   └── password.service.ts
│   │       │   ├── strategies/
│   │       │   │   ├── jwt.strategy.ts
│   │       │   │   └── local.strategy.ts
│   │       │   ├── dto/
│   │       │   │   ├── login.dto.ts
│   │       │   │   └── register.dto.ts
│   │       │   └── auth.module.ts
│   │       │
│   │       ├── notifications/
│   │       │   ├── controllers/
│   │       │   │   └── notifications.controller.ts
│   │       │   ├── services/
│   │       │   │   ├── notification.service.ts
│   │       │   │   ├── email.service.ts
│   │       │   │   └── sms.service.ts
│   │       │   ├── dto/
│   │       │   │   └── send-notification.dto.ts
│   │       │   └── notifications.module.ts
│   │       │
│   │       ├── uploads/
│   │       │   ├── controllers/
│   │       │   │   └── uploads.controller.ts
│   │       │   ├── services/
│   │       │   │   ├── upload.service.ts
│   │       │   │   └── storage.service.ts
│   │       │   └── uploads.module.ts
│   │       │
│   │       └── shared.module.ts
│   │
│   ├── infrastructure/                # External integrations
│   │   ├── database/
│   │   │   ├── mongodb/
│   │   │   │   ├── repositories/
│   │   │   │   └── mongodb.module.ts
│   │   │   ├── redis/
│   │   │   │   └── redis.module.ts
│   │   │   └── elasticsearch/
│   │   │       └── elasticsearch.module.ts
│   │   │
│   │   ├── messaging/
│   │   │   ├── queues/
│   │   │   │   ├── email.queue.ts
│   │   │   │   ├── notification.queue.ts
│   │   │   │   └── analytics.queue.ts
│   │   │   ├── events/
│   │   │   │   ├── user-created.event.ts
│   │   │   │   └── order-placed.event.ts
│   │   │   └── messaging.module.ts
│   │   │
│   │   ├── external/
│   │   │   ├── payment-gateway/
│   │   │   │   ├── stripe.service.ts
│   │   │   │   └── paypal.service.ts
│   │   │   ├── email-provider/
│   │   │   │   ├── sendgrid.service.ts
│   │   │   │   └── ses.service.ts
│   │   │   └── sms-provider/
│   │   │       └── twilio.service.ts
│   │   │
│   │   └── infrastructure.module.ts
│   │
│   ├── config/                        # Configuration
│   │   ├── app.config.ts
│   │   ├── database.config.ts
│   │   ├── auth.config.ts
│   │   └── redis.config.ts
│   │
│   ├── app.module.ts
│   └── main.ts
│
├── test/                              # Testing
│   ├── unit/
│   │   ├── admin/
│   │   ├── client/
│   │   └── vendor/
│   ├── integration/
│   │   └── ...
│   └── e2e/
│       ├── admin.e2e-spec.ts
│       ├── client.e2e-spec.ts
│       └── vendor.e2e-spec.ts
│
├── docs/                              # Documentation
│   ├── api/
│   │   ├── admin-api.md
│   │   ├── client-api.md
│   │   └── vendor-api.md
│   ├── architecture/
│   │   ├── diagrams/
│   │   └── decisions/
│   └── guides/
│       ├── deployment.md
│       └── development.md
│
├── scripts/                           # Utility scripts
│   ├── seed/
│   │   ├── seed-admin.ts
│   │   ├── seed-clients.ts
│   │   └── seed-vendors.ts
│   ├── migration/
│   └── deploy/
│
├── .env.example
├── .eslintrc.js
├── .prettierrc
├── docker-compose.yml
├── Dockerfile
├── package.json
├── tsconfig.json
└── README.md
```

---

## Module Organization

### Admin Module Structure

```typescript
// src/modules/admin/admin.module.ts
import { Module } from '@nestjs/common';
import { AdminUsersModule } from './users/admin-users.module';
import { AdminDashboardModule } from './dashboard/admin-dashboard.module';
import { AdminSettingsModule } from './settings/admin-settings.module';

@Module({
  imports: [
    AdminUsersModule,
    AdminDashboardModule,
    AdminSettingsModule,
  ],
})
export class AdminModule {}
```

### Client Module Structure

```typescript
// src/modules/client/client.module.ts
import { Module } from '@nestjs/common';
import { ClientProfileModule } from './profile/client-profile.module';
import { ClientOrdersModule } from './orders/client-orders.module';
import { ClientPaymentsModule } from './payments/client-payments.module';

@Module({
  imports: [
    ClientProfileModule,
    ClientOrdersModule,
    ClientPaymentsModule,
  ],
})
export class ClientModule {}
```

### Vendor Module Structure

```typescript
// src/modules/vendor/vendor.module.ts
import { Module } from '@nestjs/common';
import { VendorProfileModule } from './profile/vendor-profile.module';
import { VendorProductsModule } from './products/vendor-products.module';
import { VendorAnalyticsModule } from './analytics/vendor-analytics.module';

@Module({
  imports: [
    VendorProfileModule,
    VendorProductsModule,
    VendorAnalyticsModule,
  ],
})
export class VendorModule {}
```

---

## Authentication & Authorization

### Role-Based Access Control (RBAC)

```typescript
// src/core/common/constants/roles.constant.ts
export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  CLIENT = 'client',
  VENDOR = 'vendor',
  GUEST = 'guest',
}

export enum Permission {
  // Admin permissions
  MANAGE_USERS = 'manage_users',
  VIEW_ANALYTICS = 'view_analytics',
  MANAGE_SETTINGS = 'manage_settings',

  // Client permissions
  CREATE_ORDER = 'create_order',
  VIEW_OWN_ORDERS = 'view_own_orders',
  MAKE_PAYMENT = 'make_payment',

  // Vendor permissions
  MANAGE_PRODUCTS = 'manage_products',
  VIEW_SALES = 'view_sales',
  MANAGE_INVENTORY = 'manage_inventory',

  // Shared permissions
  UPDATE_PROFILE = 'update_profile',
  VIEW_NOTIFICATIONS = 'view_notifications',
}

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.SUPER_ADMIN]: [
    Permission.MANAGE_USERS,
    Permission.VIEW_ANALYTICS,
    Permission.MANAGE_SETTINGS,
  ],
  [UserRole.ADMIN]: [
    Permission.VIEW_ANALYTICS,
    Permission.MANAGE_SETTINGS,
  ],
  [UserRole.CLIENT]: [
    Permission.CREATE_ORDER,
    Permission.VIEW_OWN_ORDERS,
    Permission.MAKE_PAYMENT,
    Permission.UPDATE_PROFILE,
    Permission.VIEW_NOTIFICATIONS,
  ],
  [UserRole.VENDOR]: [
    Permission.MANAGE_PRODUCTS,
    Permission.VIEW_SALES,
    Permission.MANAGE_INVENTORY,
    Permission.UPDATE_PROFILE,
    Permission.VIEW_NOTIFICATIONS,
  ],
  [UserRole.GUEST]: [],
};
```

### Role Decorator

```typescript
// src/core/common/decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../constants/roles.constant';

export const ROLES_KEY = 'roles';
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
```

### Roles Guard

```typescript
// src/core/common/guards/roles.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { UserRole } from '../constants/roles.constant';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    return requiredRoles.some((role) => user.roles?.includes(role));
  }
}
```

### Permission Decorator & Guard

```typescript
// src/core/common/decorators/permissions.decorator.ts
import { SetMetadata } from '@nestjs/common';
import { Permission } from '../constants/roles.constant';

export const PERMISSIONS_KEY = 'permissions';
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

// src/core/common/guards/permissions.guard.ts
import { Injectable, CanActivate, ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Permission, ROLE_PERMISSIONS } from '../constants/roles.constant';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<Permission[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    const userPermissions = this.getUserPermissions(user);

    return requiredPermissions.every((permission) =>
      userPermissions.includes(permission),
    );
  }

  private getUserPermissions(user: any): Permission[] {
    const permissions: Permission[] = [];
    user.roles?.forEach((role: string) => {
      const rolePerms = ROLE_PERMISSIONS[role as keyof typeof ROLE_PERMISSIONS];
      if (rolePerms) {
        permissions.push(...rolePerms);
      }
    });
    return [...new Set(permissions)];
  }
}
```

### Usage in Controllers

```typescript
// Admin Controller
import { Controller, Get, UseGuards } from '@nestjs/common';
import { Roles } from '@/core/common/decorators/roles.decorator';
import { RolesGuard } from '@/core/common/guards/roles.guard';
import { UserRole } from '@/core/common/constants/roles.constant';

@Controller('admin/users')
@UseGuards(RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminUsersController {
  @Get()
  getAllUsers() {
    return 'Admin can see all users';
  }
}

// Client Controller
@Controller('client/orders')
@UseGuards(RolesGuard)
@Roles(UserRole.CLIENT)
export class ClientOrdersController {
  @Post()
  createOrder(@CurrentUser() user: any, @Body() dto: CreateOrderDto) {
    return this.ordersService.create(user.id, dto);
  }
}

// Vendor Controller
@Controller('vendor/products')
@UseGuards(RolesGuard, PermissionsGuard)
@Roles(UserRole.VENDOR)
export class VendorProductsController {
  @Post()
  @RequirePermissions(Permission.MANAGE_PRODUCTS)
  createProduct(@CurrentUser() user: any, @Body() dto: CreateProductDto) {
    return this.productsService.create(user.id, dto);
  }
}
```

---

## Best Practices

### 1. **Base Entity Pattern**

```typescript
// src/core/database/base/base.entity.ts
import { Prop } from '@nestjs/mongoose';

export abstract class BaseEntity {
  @Prop({ type: Date, default: Date.now })
  createdAt: Date;

  @Prop({ type: Date, default: Date.now })
  updatedAt: Date;

  @Prop({ type: String })
  createdBy?: string;

  @Prop({ type: String })
  updatedBy?: string;

  @Prop({ type: Boolean, default: false })
  isDeleted: boolean;

  @Prop({ type: Date })
  deletedAt?: Date;
}
```

### 2. **Repository Pattern**

```typescript
// src/core/database/base/base.repository.ts
import { Model, FilterQuery, UpdateQuery } from 'mongoose';
import { PaginationParams } from '@/core/interfaces/pagination.interface';

export abstract class BaseRepository<T> {
  constructor(protected readonly model: Model<T>) {}

  async create(data: Partial<T>): Promise<T> {
    const entity = new this.model(data);
    return entity.save();
  }

  async findById(id: string): Promise<T | null> {
    return this.model.findById(id).exec();
  }

  async findOne(filter: FilterQuery<T>): Promise<T | null> {
    return this.model.findOne(filter).exec();
  }

  async findAll(
    filter: FilterQuery<T> = {},
    pagination?: PaginationParams,
  ): Promise<T[]> {
    const query = this.model.find(filter);

    if (pagination) {
      query.skip(pagination.skip || 0).limit(pagination.limit || 10);
    }

    return query.exec();
  }

  async update(id: string, data: UpdateQuery<T>): Promise<T | null> {
    return this.model.findByIdAndUpdate(id, data, { new: true }).exec();
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.model.findByIdAndDelete(id).exec();
    return !!result;
  }

  async softDelete(id: string): Promise<T | null> {
    return this.model
      .findByIdAndUpdate(
        id,
        { isDeleted: true, deletedAt: new Date() },
        { new: true },
      )
      .exec();
  }

  async count(filter: FilterQuery<T> = {}): Promise<number> {
    return this.model.countDocuments(filter).exec();
  }
}
```

### 3. **Service Layer Pattern**

```typescript
// src/modules/admin/users/services/admin-users.service.ts
import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { BusinessException } from '@/core/exceptions/business.exception';
import { ErrorHandler } from '@/core/common/utils/error-handler.util';
import { User } from '../entities/user.entity';
import { CreateUserDto } from '../dto/create-user.dto';
import { BaseRepository } from '@/core/database/base/base.repository';

export class UsersRepository extends BaseRepository<User> {
  constructor(@InjectModel(User.name) userModel: Model<User>) {
    super(userModel);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.findOne({ email, isDeleted: false });
  }
}

@Injectable()
export class AdminUsersService {
  private readonly logger = new Logger(AdminUsersService.name);

  constructor(private readonly usersRepository: UsersRepository) {}

  async create(dto: CreateUserDto): Promise<User> {
    // Check for duplicate email
    const existing = await this.usersRepository.findByEmail(dto.email);
    if (existing) {
      throw BusinessException.duplicateResource('User', 'email');
    }

    // Create user with error handling
    return ErrorHandler.handleDatabaseOperation(
      () => this.usersRepository.create(dto),
      'create',
      'users',
      this.logger,
    );
  }

  async findById(id: string): Promise<User> {
    const user = await this.usersRepository.findById(id);
    if (!user || user.isDeleted) {
      throw BusinessException.resourceNotFound('User', id);
    }
    return user;
  }

  async findAll(query: any) {
    const { page = 1, limit = 10, ...filters } = query;
    const skip = (page - 1) * limit;

    const [users, total] = await Promise.all([
      this.usersRepository.findAll({ ...filters, isDeleted: false }, { skip, limit }),
      this.usersRepository.count({ ...filters, isDeleted: false }),
    ]);

    return {
      data: users,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async update(id: string, dto: Partial<User>): Promise<User> {
    const user = await this.findById(id);

    return ErrorHandler.handleDatabaseOperation(
      () => this.usersRepository.update(id, dto),
      'update',
      'users',
      this.logger,
    );
  }

  async delete(id: string): Promise<void> {
    await this.findById(id);
    await this.usersRepository.softDelete(id);
    this.logger.log(`User ${id} deleted`);
  }
}
```

### 4. **DTOs with Validation**

```typescript
// src/modules/admin/users/dto/create-user.dto.ts
import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsString,
  MinLength,
  IsOptional,
  Matches,
} from 'class-validator';
import { UserRole } from '@/core/common/constants/roles.constant';

export class CreateUserDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @MinLength(8)
  @Matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/, {
    message: 'Password must contain uppercase, lowercase, number and special character',
  })
  password: string;

  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsEnum(UserRole)
  role: UserRole;

  @IsString()
  @IsOptional()
  phone?: string;
}
```

### 5. **API Versioning**

```typescript
// main.ts
app.enableVersioning({
  type: VersioningType.URI,
  defaultVersion: '1',
});

// Controller
@Controller({
  path: 'admin/users',
  version: '1',
})
export class AdminUsersV1Controller {}

@Controller({
  path: 'admin/users',
  version: '2',
})
export class AdminUsersV2Controller {}
```

---

## Scalability Patterns

### 1. **Microservices Architecture**

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  Admin Service  │     │ Client Service  │     │ Vendor Service  │
│  (Port 3001)    │     │  (Port 3002)    │     │  (Port 3003)    │
└────────┬────────┘     └────────┬────────┘     └────────┬────────┘
         │                       │                        │
         └───────────────────────┼────────────────────────┘
                                 │
                    ┌────────────▼───────────┐
                    │    API Gateway         │
                    │    (Port 3000)         │
                    └────────────────────────┘
```

### 2. **CQRS (Command Query Responsibility Segregation)**

```typescript
// Commands (Write Operations)
export class CreateOrderCommand {
  constructor(
    public readonly clientId: string,
    public readonly items: OrderItem[],
  ) {}
}

@CommandHandler(CreateOrderCommand)
export class CreateOrderHandler {
  async execute(command: CreateOrderCommand) {
    // Handle order creation
  }
}

// Queries (Read Operations)
export class GetOrderQuery {
  constructor(public readonly orderId: string) {}
}

@QueryHandler(GetOrderQuery)
export class GetOrderHandler {
  async execute(query: GetOrderQuery) {
    // Handle order retrieval
  }
}
```

### 3. **Event-Driven Architecture**

```typescript
// Event
export class OrderCreatedEvent {
  constructor(
    public readonly orderId: string,
    public readonly clientId: string,
    public readonly amount: number,
  ) {}
}

// Event Handler
@Injectable()
export class OrderCreatedHandler {
  @OnEvent('order.created')
  async handle(event: OrderCreatedEvent) {
    // Send notification
    // Update analytics
    // Trigger workflows
  }
}

// Emit event
this.eventEmitter.emit('order.created', new OrderCreatedEvent(...));
```

### 4. **Caching Strategy**

```typescript
// Cache Decorator
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject, Injectable } from '@nestjs/common';
import { Cache } from 'cache-manager';

@Injectable()
export class ProductsService {
  constructor(@Inject(CACHE_MANAGER) private cacheManager: Cache) {}

  async getProduct(id: string) {
    // Check cache
    const cached = await this.cacheManager.get(`product:${id}`);
    if (cached) return cached;

    // Get from DB
    const product = await this.productsRepository.findById(id);

    // Set cache
    await this.cacheManager.set(`product:${id}`, product, 3600);

    return product;
  }
}
```

---

## Example Implementation

### Complete Admin User Management Feature

```typescript
// 1. Entity
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { BaseEntity } from '@/core/database/base/base.entity';
import { UserRole } from '@/core/common/constants/roles.constant';

@Schema()
export class User extends BaseEntity {
  @Prop({ required: true, unique: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({ required: true })
  firstName: string;

  @Prop({ required: true })
  lastName: string;

  @Prop({ type: [String], enum: UserRole, default: [UserRole.CLIENT] })
  roles: UserRole[];

  @Prop()
  phone?: string;

  @Prop({ default: true })
  isActive: boolean;

  @Prop()
  lastLogin?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

// 2. Repository
@Injectable()
export class UsersRepository extends BaseRepository<User> {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {
    super(userModel);
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.findOne({ email, isDeleted: false });
  }

  async findActiveUsers(): Promise<User[]> {
    return this.findAll({ isActive: true, isDeleted: false });
  }
}

// 3. Service
@Injectable()
export class AdminUsersService {
  private readonly logger = new Logger(AdminUsersService.name);

  constructor(
    private readonly usersRepository: UsersRepository,
    private readonly passwordService: PasswordService,
  ) {}

  async create(dto: CreateUserDto): Promise<User> {
    const existing = await this.usersRepository.findByEmail(dto.email);
    if (existing) {
      throw BusinessException.duplicateResource('User', 'email');
    }

    const hashedPassword = await this.passwordService.hash(dto.password);

    return ErrorHandler.handleDatabaseOperation(
      () =>
        this.usersRepository.create({
          ...dto,
          password: hashedPassword,
          roles: [dto.role],
        }),
      'create',
      'users',
      this.logger,
    );
  }

  async findAll(query: QueryUserDto) {
    const { page = 1, limit = 10, role, isActive, search } = query;
    const skip = (page - 1) * limit;

    const filter: any = { isDeleted: false };
    if (role) filter.roles = role;
    if (isActive !== undefined) filter.isActive = isActive;
    if (search) {
      filter.$or = [
        { email: new RegExp(search, 'i') },
        { firstName: new RegExp(search, 'i') },
        { lastName: new RegExp(search, 'i') },
      ];
    }

    const [users, total] = await Promise.all([
      this.usersRepository.findAll(filter, { skip, limit }),
      this.usersRepository.count(filter),
    ]);

    return {
      data: users.map(user => this.sanitizeUser(user)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  private sanitizeUser(user: User): Partial<User> {
    const { password, ...sanitized } = user.toObject();
    return sanitized;
  }
}

// 4. Controller
@Controller('admin/users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
export class AdminUsersController {
  constructor(private readonly usersService: AdminUsersService) {}

  @Post()
  @RequirePermissions(Permission.MANAGE_USERS)
  async create(@Body() dto: CreateUserDto) {
    const user = await this.usersService.create(dto);
    return {
      success: true,
      data: user,
      message: 'User created successfully',
    };
  }

  @Get()
  async findAll(@Query() query: QueryUserDto) {
    return this.usersService.findAll(query);
  }

  @Get(':id')
  async findOne(@Param('id') id: string) {
    const user = await this.usersService.findById(id);
    return {
      success: true,
      data: user,
    };
  }

  @Patch(':id')
  @RequirePermissions(Permission.MANAGE_USERS)
  async update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    const user = await this.usersService.update(id, dto);
    return {
      success: true,
      data: user,
      message: 'User updated successfully',
    };
  }

  @Delete(':id')
  @RequirePermissions(Permission.MANAGE_USERS)
  async delete(@Param('id') id: string) {
    await this.usersService.delete(id);
    return {
      success: true,
      message: 'User deleted successfully',
    };
  }
}

// 5. Module
@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    SharedModule, // For PasswordService
  ],
  controllers: [AdminUsersController],
  providers: [AdminUsersService, UsersRepository],
  exports: [AdminUsersService, UsersRepository],
})
export class AdminUsersModule {}
```

---

## Summary

### Key Takeaways

1. **Organize by User Type** - Separate modules for Admin, Client, Vendor
2. **Domain-Driven Design** - Group by business domains, not technical layers
3. **Shared Modules** - Extract common functionality (auth, notifications)
4. **Base Classes** - Use repository and entity base classes
5. **RBAC** - Implement role and permission-based access control
6. **Error Handling** - Use custom exceptions with proper error handling
7. **Scalability** - Design for microservices, CQRS, event-driven patterns
8. **Type Safety** - Full TypeScript with proper interfaces and DTOs

### Next Steps

1. Start with core modules (auth, users)
2. Build one user type module completely (e.g., Client)
3. Replicate pattern for other user types
4. Add shared modules as needed
5. Implement messaging and caching
6. Add monitoring and logging
7. Write comprehensive tests
8. Document APIs

---

**See Also:**
- [PROJECT_STRUCTURE.md](./PROJECT_STRUCTURE.md) - Current project structure
- [ERROR_HANDLING.md](./ERROR_HANDLING.md) - Error handling guide
- [README.md](./README.md) - Getting started

**Last Updated:** 2025-11-01
