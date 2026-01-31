import {
  Controller,
  Get,
  Post,
  Put,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { UserRole } from '@/common/constants/roles.constant';
import { CurrentUser } from '@/common/decorators/current-user.decorator';

/**
 * Client orders controller
 * Requires authentication and client role
 */
@Controller('client/orders')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.CLIENT)
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  /**
   * Create a new order
   */
  @Post()
  async create(
    @Body() createOrderDto: CreateOrderDto,
    @CurrentUser() currentUser: { userId: string },
  ) {
    const order = await this.ordersService.createOrder(
      createOrderDto,
      currentUser.userId,
    );
    return {
      success: true,
      data: order,
      message: 'Order created successfully',
    };
  }

  /**
   * Get client's orders
   */
  @Get()
  async findAll(
    @CurrentUser() currentUser: { userId: string },
    @Query('skip') skip?: string,
    @Query('limit') limit?: string,
  ) {
    const skipNum = skip ? parseInt(skip, 10) : 0;
    const limitNum = limit ? parseInt(limit, 10) : 10;

    const result = await this.ordersService.getClientOrders(
      currentUser.userId,
      skipNum,
      limitNum,
    );

    return {
      success: true,
      data: result.data,
      total: result.total,
      skip: skipNum,
      limit: limitNum,
    };
  }

  /**
   * Get order by ID
   */
  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() currentUser: { userId: string },
  ) {
    const order = await this.ordersService.getClientOrder(
      id,
      currentUser.userId,
    );
    return {
      success: true,
      data: order,
    };
  }

  /**
   * Cancel order
   */
  @Put(':id/cancel')
  async cancel(
    @Param('id') id: string,
    @CurrentUser() currentUser: { userId: string },
  ) {
    const order = await this.ordersService.cancelOrder(id, currentUser.userId);
    return {
      success: true,
      data: order,
      message: 'Order cancelled successfully',
    };
  }
}
