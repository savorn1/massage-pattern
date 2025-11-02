import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Order, OrderDocument, OrderStatus } from '@/modules/shared/entities';
import { CreateOrderDto } from './dto/create-order.dto';
import { BaseRepository } from '@/core/database/base/base.repository';
import { BusinessException } from '@/core/exceptions/business.exception';

/**
 * Service for managing client orders
 */
@Injectable()
export class OrdersService extends BaseRepository<OrderDocument> {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
  ) {
    super(orderModel);
  }

  /**
   * Create a new order
   */
  async createOrder(
    createOrderDto: CreateOrderDto,
    clientId: string,
  ): Promise<OrderDocument> {
    // Calculate total amount
    const totalAmount = createOrderDto.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );

    const orderData = {
      ...createOrderDto,
      clientId,
      totalAmount,
      status: OrderStatus.PENDING,
      createdBy: clientId,
    };

    const order = await this.create(orderData);
    this.logger.log(`Order created: ${String(order._id)}`);
    return order;
  }

  /**
   * Get orders for a specific client
   */
  async getClientOrders(clientId: string, skip = 0, limit = 10) {
    return this.findWithPagination(
      { clientId, isDeleted: false },
      { skip, limit },
      { createdAt: -1 },
    );
  }

  /**
   * Get order by ID (with client verification)
   */
  async getClientOrder(
    orderId: string,
    clientId: string,
  ): Promise<OrderDocument> {
    const order = await this.findById(orderId);
    if (!order) {
      throw BusinessException.resourceNotFound('Order', orderId);
    }

    // Verify the order belongs to the client
    if (order.clientId !== clientId) {
      throw BusinessException.invalidOperation(
        'You do not have permission to view this order',
      );
    }

    return order;
  }

  /**
   * Update order status
   */
  async updateOrderStatus(
    orderId: string,
    status: OrderStatus,
    userId: string,
  ): Promise<OrderDocument | null> {
    const order = await this.update(orderId, {
      status,
      updatedBy: userId,
    } as unknown as OrderDocument);
    if (!order) {
      throw BusinessException.resourceNotFound('Order', orderId);
    }

    this.logger.log(`Order ${orderId} status updated to ${status}`);
    return order;
  }

  /**
   * Cancel order
   */
  async cancelOrder(
    orderId: string,
    clientId: string,
  ): Promise<OrderDocument | null> {
    const order = await this.getClientOrder(orderId, clientId);

    // Only pending or confirmed orders can be cancelled
    if (
      order.status !== OrderStatus.PENDING &&
      order.status !== OrderStatus.CONFIRMED
    ) {
      throw BusinessException.invalidOperation(
        'Only pending or confirmed orders can be cancelled',
      );
    }

    return this.updateOrderStatus(orderId, OrderStatus.CANCELLED, clientId);
  }
}
