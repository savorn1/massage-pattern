import { Schema } from 'mongoose';

/**
 * Mongoose plugin to add base entity fields and behavior
 * Automatically adds audit trail fields and soft delete functionality
 */
export function baseEntityPlugin(schema: Schema): void {
  // Add base entity fields
  schema.add({
    createdAt: {
      type: Date,
      default: Date.now,
      immutable: true, // Cannot be modified after creation
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
    createdBy: {
      type: String,
      immutable: true, // Cannot be modified after creation
    },
    updatedBy: {
      type: String,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true, // Index for efficient queries
    },
    deletedAt: {
      type: Date,
    },
    deletedBy: {
      type: String,
    },
  });

  // Pre-save hook to update timestamp
  schema.pre('save', function (next) {
    this.updatedAt = new Date();
    next();
  });

  // Pre-update hook to update timestamp
  schema.pre('findOneAndUpdate', function (next) {
    this.set({ updatedAt: new Date() });
    next();
  });

  schema.pre('updateOne', function (next) {
    this.set({ updatedAt: new Date() });
    next();
  });

  schema.pre('updateMany', function (next) {
    this.set({ updatedAt: new Date() });
    next();
  });

  // Add instance methods
  schema.methods.softDelete = function (
    this: {
      isDeleted: boolean;
      deletedAt?: Date;
      deletedBy?: string;
      save: () => Promise<unknown>;
    },
    userId?: string,
  ) {
    this.isDeleted = true;
    this.deletedAt = new Date();
    this.deletedBy = userId;
    return this.save();
  };

  schema.methods.restore = function (this: {
    isDeleted: boolean;
    deletedAt?: Date;
    deletedBy?: string;
    save: () => Promise<unknown>;
  }) {
    this.isDeleted = false;
    this.deletedAt = undefined;
    this.deletedBy = undefined;
    return this.save();
  };

  // Add static methods for common queries
  schema.statics.findActive = function (
    this: {
      find: (filter: Record<string, unknown>) => unknown;
    },
    filter: Record<string, unknown> = {},
  ) {
    return this.find({ ...filter, isDeleted: false });
  };

  schema.statics.findDeleted = function (
    this: {
      find: (filter: Record<string, unknown>) => unknown;
    },
    filter: Record<string, unknown> = {},
  ) {
    return this.find({ ...filter, isDeleted: true });
  };

  schema.statics.countActive = function (
    this: {
      countDocuments: (filter: Record<string, unknown>) => unknown;
    },
    filter: Record<string, unknown> = {},
  ) {
    return this.countDocuments({ ...filter, isDeleted: false });
  };

  schema.statics.countDeleted = function (
    this: {
      countDocuments: (filter: Record<string, unknown>) => unknown;
    },
    filter: Record<string, unknown> = {},
  ) {
    return this.countDocuments({ ...filter, isDeleted: true });
  };
}
