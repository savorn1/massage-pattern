/**
 * Pagination query parameters interface
 */
export interface PaginationParams {
  limit?: number;
  skip?: number;
  page?: number;
}

/**
 * Pagination metadata interface
 */
export interface PaginationMeta {
  total: number;
  limit: number;
  skip: number;
  page?: number;
  totalPages?: number;
  hasMore: boolean;
  hasPrevious?: boolean;
}
