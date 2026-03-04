import { Schema } from 'mongoose';

/**
 * Mongoose plugin that adds auto-timestamp hooks, soft-delete instance methods,
 * and findActive/findDeleted static methods to every schema.
 *
 * Fields (createdAt, updatedAt, isDeleted, etc.) are declared via @Prop() in
 * BaseEntity — this plugin adds the *behavior* on top.
 *
 * Registered globally in DatabaseModule so it applies to every schema.
 */
export function baseEntityPlugin(schema: Schema): void {
  // ─── Auto-update updatedAt ──────────────────────────────────────────────
  // `timestamps: true` on each @Schema handles save() / insertMany().
  // These hooks cover the remaining Mongoose query operations.
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

  // ─── Soft-delete instance methods ──────────────────────────────────────

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

  // ─── Static query helpers ───────────────────────────────────────────────

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
