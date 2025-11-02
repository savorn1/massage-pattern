import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Product, ProductDocument } from '@/modules/shared/entities';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { BaseRepository } from '@/core/database/base/base.repository';
import { BusinessException } from '@/core/exceptions/business.exception';

/**
 * Service for managing vendor products
 */
@Injectable()
export class ProductsService extends BaseRepository<ProductDocument> {
  private readonly logger = new Logger(ProductsService.name);

  constructor(
    @InjectModel(Product.name)
    private readonly productModel: Model<ProductDocument>,
  ) {
    super(productModel);
  }

  /**
   * Create a new product
   */
  async createProduct(
    createProductDto: CreateProductDto,
    vendorId: string,
  ): Promise<ProductDocument> {
    const productData = {
      ...createProductDto,
      vendorId,
      createdBy: vendorId,
    };

    const product = await this.create(productData);
    this.logger.log(`Product created: ${String(product._id)}`);
    return product;
  }

  /**
   * Get products for a specific vendor
   */
  async getVendorProducts(vendorId: string, skip = 0, limit = 10) {
    return this.findWithPagination(
      { vendorId, isDeleted: false },
      { skip, limit },
      { createdAt: -1 },
    );
  }

  /**
   * Get product by ID (with vendor verification)
   */
  async getVendorProduct(
    productId: string,
    vendorId: string,
  ): Promise<ProductDocument> {
    const product = await this.findById(productId);
    if (!product) {
      throw BusinessException.resourceNotFound('Product', productId);
    }

    // Verify the product belongs to the vendor
    if (product.vendorId !== vendorId) {
      throw BusinessException.invalidOperation(
        'You do not have permission to access this product',
      );
    }

    return product;
  }

  /**
   * Update product
   */
  async updateProduct(
    productId: string,
    updateProductDto: UpdateProductDto,
    vendorId: string,
  ): Promise<ProductDocument | null> {
    // Verify ownership first
    await this.getVendorProduct(productId, vendorId);

    const product = await this.update(productId, {
      ...updateProductDto,
      updatedBy: vendorId,
    } as unknown as ProductDocument);

    if (!product) {
      throw BusinessException.resourceNotFound('Product', productId);
    }

    this.logger.log(`Product updated: ${productId}`);
    return product;
  }

  /**
   * Delete product (soft delete)
   */
  async deleteProduct(
    productId: string,
    vendorId: string,
  ): Promise<ProductDocument | null> {
    // Verify ownership first
    await this.getVendorProduct(productId, vendorId);

    const product = await this.softDelete(productId, vendorId);
    if (!product) {
      throw BusinessException.resourceNotFound('Product', productId);
    }

    this.logger.log(`Product deleted: ${productId}`);
    return product;
  }

  /**
   * Update product stock
   */
  async updateStock(
    productId: string,
    stock: number,
    vendorId: string,
  ): Promise<ProductDocument | null> {
    await this.getVendorProduct(productId, vendorId);

    const product = await this.update(productId, {
      stock,
      updatedBy: vendorId,
    } as unknown as ProductDocument);

    if (!product) {
      throw BusinessException.resourceNotFound('Product', productId);
    }

    this.logger.log(`Product ${productId} stock updated to ${stock}`);
    return product;
  }
}
