import { apiSlice } from "./apiSlice";

type PaginationMeta = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
};

type Envelope<T> = { success: true; data: T; message?: string };

export type CategoryItem = {
  id: string;
  categoryCode: string;
  name: string;
  description: string | null;
  parentId: string | null;
  parent?: CategoryItem | null;
  level: number;
  path: string;
  productCount: number;
  isActive: boolean;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CategoryDetail = CategoryItem & {
  children?: CategoryItem[];
};

export type ListCategoriesArgs = {
  page?: number;
  pageSize?: number;
  search?: string;
  parentId?: string;
};

export type ListCategoriesResponse = {
  items: CategoryItem[];
  meta: PaginationMeta;
};

export type CreateCategoryRequest = {
  name: string;
  categoryCode?: string;
  description?: string;
  parentId?: string;
  isActive?: boolean;
};

export type UpdateCategoryRequest = Partial<CreateCategoryRequest>;

export type ProductStatus = "ACTIVE" | "INACTIVE" | "DISCONTINUED" | "OUT_OF_STOCK";

export type ProductItem = {
  id: string;
  productCode: string;
  sku: string;
  name: string;
  description: string | null;
  categoryId: string | null;
  category?: CategoryItem | null;
  unit: string;
  costPrice: number | string;
  sellingPrice: number | string;
  currency: string;
  minStockLevel: number;
  maxStockLevel: number;
  reorderPoint: number;
  status: ProductStatus;
  barcode: string | null;
  weight: number | string | null;
  dimensions: string | null;
  imageUrl: string | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ProductDetail = ProductItem & {
  stockSummary?: ProductStockSummary;
};

export type ProductStockSummary = {
  productId: string;
  totalQuantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  warehouseCount: number;
  warehouses: {
    warehouseId: string;
    warehouseName: string;
    quantity: number;
    reserved: number;
    available: number;
  }[];
};

export type ListProductsArgs = {
  page?: number;
  pageSize?: number;
  search?: string;
  categoryId?: string;
  status?: ProductStatus;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
};

export type ListProductsResponse = {
  items: ProductItem[];
  meta: PaginationMeta;
};

export type ListLowStockProductsArgs = {
  page?: number;
  pageSize?: number;
  search?: string;
  threshold?: number;
};

export type ListLowStockProductsResponse = {
  items: (ProductItem & { currentStock: number; reorderPoint: number })[];
  meta: PaginationMeta;
};

export type CreateProductRequest = {
  name: string;
  sku?: string;
  productCode?: string;
  description?: string;
  categoryId?: string;
  unit?: string;
  costPrice?: number;
  sellingPrice?: number;
  unitPrice?: number;
  currency?: string;
  minStockLevel?: number;
  maxStockLevel?: number;
  reorderPoint?: number;
  minimumLevel?: number;
  status?: ProductStatus;
  barcode?: string;
  weight?: number;
  weightKg?: number;
  unitOfMeasure?: string;
  dimensions?: string;
  imageUrl?: string;
};

export type UpdateProductRequest = Partial<CreateProductRequest>;

export type WarehouseItem = {
  id: string;
  warehouseCode: string;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  postalCode: string | null;
  phone: string | null;
  email: string | null;
  managerId: string | null;
  manager?: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
  isActive: boolean;
  capacity: number | string | null;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
};

export type WarehouseDetail = WarehouseItem;

export type ListWarehousesArgs = {
  page?: number;
  pageSize?: number;
  search?: string;
  isActive?: boolean;
};

export type ListWarehousesResponse = {
  items: WarehouseItem[];
  meta: PaginationMeta;
};

export type CreateWarehouseRequest = {
  name: string;
  warehouseCode?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  phone?: string;
  email?: string;
  managerId?: string;
  capacity?: number;
  isActive?: boolean;
};

export type UpdateWarehouseRequest = Partial<CreateWarehouseRequest>;

export type StockItem = {
  id: string;
  productId: string;
  product?: ProductItem | null;
  warehouseId: string;
  warehouse?: WarehouseItem | null;
  quantity: number;
  reservedQuantity: number;
  availableQuantity: number;
  unitCost: number | string;
  totalValue: number | string;
  lastMovementAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type ListStockArgs = {
  page?: number;
  pageSize?: number;
  productId?: string;
  warehouseId?: string;
  lowOnly?: boolean;
};

export type ListStockResponse = {
  items: StockItem[];
  meta: PaginationMeta;
};

export type MovementType =
  | "RECEIPT"
  | "ISSUE"
  | "TRANSFER_IN"
  | "TRANSFER_OUT"
  | "ADJUSTMENT"
  | "RETURN"
  | "SALE"
  | "PURCHASE";

export type MovementItem = {
  id: string;
  movementCode: string;
  movementType: MovementType;
  productId: string;
  product?: ProductItem | null;
  warehouseId: string;
  warehouse?: WarehouseItem | null;
  fromWarehouseId: string | null;
  fromWarehouse?: WarehouseItem | null;
  toWarehouseId: string | null;
  toWarehouse?: WarehouseItem | null;
  quantity: number;
  unitCost: number | string | null;
  totalValue: number | string | null;
  reference: string | null;
  note: string | null;
  transferId: string | null;
  createdById: string | null;
  createdAt: string;
};

export type MovementDetail = MovementItem;

export type ListMovementsArgs = {
  page?: number;
  pageSize?: number;
  movementType?: MovementType;
  productId?: string;
  warehouseId?: string;
  fromDate?: string;
  toDate?: string;
};

export type ListMovementsResponse = {
  items: MovementItem[];
  meta: PaginationMeta;
};

export type CreateMovementRequest = {
  movementType: MovementType;
  productId: string;
  warehouseId: string;
  quantity: number;
  unitCost?: number;
  reference?: string;
  note?: string;
};

export type CreateTransferRequest = {
  fromWarehouseId: string;
  toWarehouseId: string;
  productId: string;
  quantity: number;
  unitCost?: number;
  reference?: string;
  note?: string;
};

export const inventoryApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    listCategories: builder.query<
      Envelope<ListCategoriesResponse>,
      ListCategoriesArgs | void
    >({
      query: (args) => ({ url: "/inventory/categories", params: args ?? {} }),
      providesTags: ["Categories"],
    }),
    getCategory: builder.query<Envelope<CategoryDetail>, string>({
      query: (id) => ({ url: `/inventory/categories/${id}` }),
      providesTags: (_, __, id) => [{ type: "Categories", id }],
    }),
    createCategory: builder.mutation<
      Envelope<{ category: CategoryItem }>,
      CreateCategoryRequest
    >({
      query: (body) => ({ url: "/inventory/categories", method: "POST", body }),
      invalidatesTags: ["Categories"],
    }),
    updateCategory: builder.mutation<
      Envelope<CategoryItem>,
      { id: string; body: UpdateCategoryRequest }
    >({
      query: ({ id, body }) => ({
        url: `/inventory/categories/${id}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: (_, __, { id }) => [
        "Categories",
        { type: "Categories", id },
      ],
    }),
    deleteCategory: builder.mutation<Envelope<{ ok: true }>, string>({
      query: (id) => ({ url: `/inventory/categories/${id}`, method: "DELETE" }),
      invalidatesTags: ["Categories"],
    }),

    listProducts: builder.query<
      Envelope<ListProductsResponse>,
      ListProductsArgs | void
    >({
      query: (args) => ({ url: "/inventory/products", params: args ?? {} }),
      providesTags: ["Products"],
    }),
    listLowStockProducts: builder.query<
      Envelope<ListLowStockProductsResponse>,
      ListLowStockProductsArgs | void
    >({
      query: (args) => ({
        url: "/inventory/products/low-stock",
        params: args ?? {},
      }),
      providesTags: ["Products", "Stock"],
    }),
    getProduct: builder.query<Envelope<ProductDetail>, string>({
      query: (id) => ({ url: `/inventory/products/${id}` }),
      providesTags: (_, __, id) => [{ type: "Products", id }],
    }),
    getProductStockSummary: builder.query<
      Envelope<ProductStockSummary>,
      string
    >({
      query: (id) => ({ url: `/inventory/products/${id}/stock-summary` }),
      providesTags: (_, __, id) => [
        { type: "Products", id },
        "Stock",
      ],
    }),
    createProduct: builder.mutation<
      Envelope<{ product: ProductItem }>,
      CreateProductRequest
    >({
      query: (body) => ({ url: "/inventory/products", method: "POST", body }),
      invalidatesTags: ["Products", "Categories"],
    }),
    updateProduct: builder.mutation<
      Envelope<ProductItem>,
      { id: string; body: UpdateProductRequest }
    >({
      query: ({ id, body }) => ({
        url: `/inventory/products/${id}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: (_, __, { id }) => [
        "Products",
        { type: "Products", id },
      ],
    }),
    deleteProduct: builder.mutation<Envelope<{ ok: true }>, string>({
      query: (id) => ({ url: `/inventory/products/${id}`, method: "DELETE" }),
      invalidatesTags: ["Products", "Stock"],
    }),

    listWarehouses: builder.query<
      Envelope<ListWarehousesResponse>,
      ListWarehousesArgs | void
    >({
      query: (args) => ({ url: "/inventory/warehouses", params: args ?? {} }),
      providesTags: ["Warehouses"],
    }),
    getWarehouse: builder.query<Envelope<WarehouseDetail>, string>({
      query: (id) => ({ url: `/inventory/warehouses/${id}` }),
      providesTags: (_, __, id) => [{ type: "Warehouses", id }],
    }),
    createWarehouse: builder.mutation<
      Envelope<{ warehouse: WarehouseItem }>,
      CreateWarehouseRequest
    >({
      query: (body) => ({ url: "/inventory/warehouses", method: "POST", body }),
      invalidatesTags: ["Warehouses"],
    }),
    updateWarehouse: builder.mutation<
      Envelope<WarehouseItem>,
      { id: string; body: UpdateWarehouseRequest }
    >({
      query: ({ id, body }) => ({
        url: `/inventory/warehouses/${id}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: (_, __, { id }) => [
        "Warehouses",
        { type: "Warehouses", id },
      ],
    }),
    deleteWarehouse: builder.mutation<Envelope<{ ok: true }>, string>({
      query: (id) => ({
        url: `/inventory/warehouses/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: ["Warehouses", "Stock"],
    }),

    listStock: builder.query<
      Envelope<ListStockResponse>,
      ListStockArgs | void
    >({
      query: (args) => ({ url: "/inventory/stock", params: args ?? {} }),
      providesTags: ["Stock"],
    }),
    getStockByKey: builder.query<
      Envelope<StockItem>,
      { productId: string; warehouseId: string }
    >({
      query: ({ productId, warehouseId }) => ({
        url: `/inventory/stock/${productId}/${warehouseId}`,
      }),
      providesTags: (_, __, { productId, warehouseId }) => [
        { type: "Stock", id: `${productId}-${warehouseId}` },
      ],
    }),

    listMovements: builder.query<
      Envelope<ListMovementsResponse>,
      ListMovementsArgs | void
    >({
      query: (args) => ({ url: "/inventory/movements", params: args ?? {} }),
      providesTags: ["Movements"],
    }),
    getMovement: builder.query<Envelope<MovementDetail>, string>({
      query: (id) => ({ url: `/inventory/movements/${id}` }),
      providesTags: (_, __, id) => [{ type: "Movements", id }],
    }),
    createMovement: builder.mutation<
      Envelope<{ movement: MovementItem }>,
      CreateMovementRequest
    >({
      query: (body) => ({ url: "/inventory/movements", method: "POST", body }),
      invalidatesTags: ["Movements", "Stock", "Products"],
    }),
    createTransfer: builder.mutation<
      Envelope<{ movements: MovementItem[]; transferId: string }>,
      CreateTransferRequest
    >({
      query: (body) => ({
        url: "/inventory/movements/transfer",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Movements", "Stock", "Products"],
    }),
  }),
  overrideExisting: false,
});

export const {
  useListCategoriesQuery,
  useGetCategoryQuery,
  useCreateCategoryMutation,
  useUpdateCategoryMutation,
  useDeleteCategoryMutation,

  useListProductsQuery,
  useListLowStockProductsQuery,
  useGetProductQuery,
  useGetProductStockSummaryQuery,
  useCreateProductMutation,
  useUpdateProductMutation,
  useDeleteProductMutation,

  useListWarehousesQuery,
  useGetWarehouseQuery,
  useCreateWarehouseMutation,
  useUpdateWarehouseMutation,
  useDeleteWarehouseMutation,

  useListStockQuery,
  useGetStockByKeyQuery,

  useListMovementsQuery,
  useGetMovementQuery,
  useCreateMovementMutation,
  useCreateTransferMutation,
} = inventoryApi;
