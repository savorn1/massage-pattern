import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { JwtAuthGuard } from '@/common/guards/jwt-auth.guard';
import { RolesGuard } from '@/common/guards/roles.guard';
import { Roles } from '@/common/decorators/roles.decorator';
import { UserRole } from '@/common/constants/roles.constant';
import { CurrentUser } from '@/common/decorators/current-user.decorator';

/**
 * Vendor products controller
 * Requires authentication and vendor role
 */
@Controller('vendor/products')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.VENDOR)
export class ProductsController {
  constructor(private readonly productsService: ProductsService) {}

  /**
   * Create a new product
   */
  @Post()
  async create(
    @Body() createProductDto: CreateProductDto,
    @CurrentUser() currentUser: { userId: string },
  ) {
    const product = await this.productsService.createProduct(
      createProductDto,
      currentUser.userId,
    );
    return {
      success: true,
      data: product,
      message: 'Product created successfully',
    };
  }

  /**
   * Get vendor's products
   */
  @Get()
  async findAll(
    @CurrentUser() currentUser: { userId: string },
    @Query('skip') skip?: string,
    @Query('limit') limit?: string,
  ) {
    const skipNum = skip ? parseInt(skip, 10) : 0;
    const limitNum = limit ? parseInt(limit, 10) : 10;

    const result = await this.productsService.getVendorProducts(
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
   * Get product by ID
   */
  @Get(':id')
  async findOne(
    @Param('id') id: string,
    @CurrentUser() currentUser: { userId: string },
  ) {
    const product = await this.productsService.getVendorProduct(
      id,
      currentUser.userId,
    );
    return {
      success: true,
      data: product,
    };
  }

  /**
   * Update product
   */
  @Put(':id')
  async update(
    @Param('id') id: string,
    @Body() updateProductDto: UpdateProductDto,
    @CurrentUser() currentUser: { userId: string },
  ) {
    const product = await this.productsService.updateProduct(
      id,
      updateProductDto,
      currentUser.userId,
    );
    return {
      success: true,
      data: product,
      message: 'Product updated successfully',
    };
  }

  /**
   * Delete product
   */
  @Delete(':id')
  async remove(
    @Param('id') id: string,
    @CurrentUser() currentUser: { userId: string },
  ) {
    await this.productsService.deleteProduct(id, currentUser.userId);
    return {
      success: true,
      message: 'Product deleted successfully',
    };
  }

  /**
   * Update product stock
   */
  @Put(':id/stock')
  async updateStock(
    @Param('id') id: string,
    @Body('stock') stock: number,
    @CurrentUser() currentUser: { userId: string },
  ) {
    const product = await this.productsService.updateStock(
      id,
      stock,
      currentUser.userId,
    );
    return {
      success: true,
      data: product,
      message: 'Stock updated successfully',
    };
  }
}
