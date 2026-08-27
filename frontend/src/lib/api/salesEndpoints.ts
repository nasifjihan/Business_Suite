import { apiSlice } from "./apiSlice";
import { useListProductsQuery } from "./inventoryEndpoints";

type PaginationMeta = {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
};

type Envelope<T> = { success: true; data: T; message?: string };

export type OrderStatus =
  | "DRAFT"
  | "PENDING"
  | "CONFIRMED"
  | "PROCESSING"
  | "SHIPPED"
  | "DELIVERED"
  | "COMPLETED"
  | "CANCELLED"
  | "REFUNDED";

export type PaymentStatus =
  | "UNPAID"
  | "PARTIALLY_PAID"
  | "PAID"
  | "OVERPAID"
  | "REFUNDED"
  | "PARTIALLY_REFUNDED";

export type PaymentMethod =
  | "CASH"
  | "CARD"
  | "BANK_TRANSFER"
  | "CREDIT"
  | "CHECK"
  | "MOBILE_PAYMENT"
  | "OTHER";

export type RefundStatus =
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "PROCESSED"
  | "COMPLETED";

export type OrderItemRequest = {
  productId: string;
  quantity: number;
  unitPrice?: number;
  discountAmount?: number;
  taxAmount?: number;
  warehouseId?: string;
};

export type CreateOrderCheckoutRequest = {
  customerId?: string;
  customerCode?: string;
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  warehouseId?: string;
  orderNumber?: string;
  orderDate?: string;
  items: OrderItemRequest[];
  subtotal?: number;
  discountAmount?: number;
  taxAmount?: number;
  shippingAmount?: number;
  totalAmount?: number;
  notes?: string;
  salespersonId?: string;
  payments?: PaymentRequest[];
  applyCredit?: boolean;
  creditAmount?: number;
  generateInvoice?: boolean;
};

export type OrderItem = {
  id: string;
  orderId: string;
  productId: string;
  product?: {
    id: string;
    productCode: string;
    sku: string;
    name: string;
    unit: string;
    imageUrl?: string | null;
  } | null;
  warehouseId?: string | null;
  quantity: number;
  unitPrice: number | string;
  subtotal: number | string;
  discountAmount: number | string;
  taxAmount: number | string;
  totalAmount: number | string;
  createdAt: string;
  updatedAt: string;
};

export type OrderDetail = {
  id: string;
  orderNumber: string;
  orderDate: string;
  customerId: string | null;
  customer?: {
    id: string;
    customerCode: string;
    name: string;
    email?: string | null;
    phone?: string | null;
  } | null;
  customerName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  warehouseId: string | null;
  warehouse?: {
    id: string;
    name: string;
    warehouseCode: string;
  } | null;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  subtotal: number | string;
  discountAmount: number | string;
  taxAmount: number | string;
  shippingAmount: number | string;
  totalAmount: number | string;
  amountPaid: number | string;
  amountDue: number | string;
  creditUsed: number | string;
  notes: string | null;
  salespersonId: string | null;
  salesperson?: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
  items?: OrderItem[];
  payments?: PaymentDetail[];
  invoices?: InvoiceSummary[];
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OrderSummaryItem = {
  id: string;
  orderNumber: string;
  customerName: string | null;
  status: OrderStatus;
  paymentStatus: PaymentStatus;
  totalAmount: number | string;
};

export type CheckoutResponse = {
  order: OrderDetail;
  items: OrderItem[];
  invoices: InvoiceSummary[];
  payments: PaymentDetail[];
  lowStockWarnings: LowStockWarning[];
};

export type LowStockWarning = {
  productId: string;
  productName: string;
  sku: string;
  currentStock: number;
  orderedQuantity: number;
  warehouseId?: string;
  warehouseName?: string;
};

export type InvoiceSummary = {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string | null;
  totalAmount: number | string;
  amountPaid: number | string;
  status: "DRAFT" | "SENT" | "PAID" | "OVERDUE" | "CANCELLED";
};

export type ListOrdersArgs = {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: OrderStatus;
  paymentStatus?: PaymentStatus;
  customerId?: string;
  warehouseId?: string;
  salespersonId?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
};

export type ListOrdersResponse = {
  items: OrderSummaryItem[];
  meta: PaginationMeta;
};

export type UpdateOrderStatusRequest = {
  status: OrderStatus;
  note?: string;
};

export type PaymentRequest = {
  paymentMethod: PaymentMethod;
  amount: number;
  referenceNumber?: string;
  paymentDate?: string;
  notes?: string;
  processedById?: string;
};

export type PaymentDetail = {
  id: string;
  paymentNumber: string;
  orderId: string;
  order?: {
    id: string;
    orderNumber: string;
  } | null;
  customerId: string | null;
  customer?: {
    id: string;
    name: string;
    customerCode: string;
  } | null;
  paymentMethod: PaymentMethod;
  amount: number | string;
  referenceNumber: string | null;
  paymentDate: string;
  status: "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED";
  notes: string | null;
  processedById: string | null;
  processedBy?: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
  gatewayTransactionId: string | null;
  createdAt: string;
};

export type PaymentSummary = {
  id: string;
  paymentNumber: string;
  orderNumber: string;
  customerName: string | null;
  paymentMethod: PaymentMethod;
  amount: number | string;
  paymentDate: string;
  status: "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED";
};

export type ListPaymentsArgs = {
  page?: number;
  pageSize?: number;
  search?: string;
  paymentMethod?: PaymentMethod;
  status?: "PENDING" | "COMPLETED" | "FAILED" | "REFUNDED";
  orderId?: string;
  customerId?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
};

export type ListPaymentsResponse = {
  items: PaymentSummary[];
  meta: PaginationMeta;
};

export type RefundItem = {
  orderItemId: string;
  productId: string;
  productName?: string;
  quantity: number;
  unitPrice?: number;
  refundAmount: number;
  reason?: string;
  restock?: boolean;
  warehouseId?: string;
};

export type CreateRefundRequest = {
  orderId: string;
  refundNumber?: string;
  refundDate?: string;
  reason?: string;
  items: RefundItem[];
  refundAmount?: number;
  restockToWarehouseId?: string;
  notes?: string;
  processedById?: string;
};

export type RefundDetail = {
  id: string;
  refundNumber: string;
  orderId: string;
  order?: {
    id: string;
    orderNumber: string;
  } | null;
  customerId: string | null;
  customer?: {
    id: string;
    name: string;
    customerCode: string;
  } | null;
  refundDate: string;
  reason: string | null;
  items?: RefundItemDetail[];
  totalRefundAmount: number | string;
  restockToWarehouseId: string | null;
  status: RefundStatus;
  notes: string | null;
  processedById: string | null;
  processedBy?: {
    id: string;
    firstName: string;
    lastName: string;
  } | null;
  approvedById: string | null;
  createdAt: string;
  updatedAt: string;
};

export type RefundItemDetail = {
  id: string;
  refundId: string;
  orderItemId: string;
  productId: string;
  product?: {
    id: string;
    name: string;
    sku: string;
  } | null;
  quantity: number;
  unitPrice: number | string;
  refundAmount: number | string;
  reason: string | null;
  restocked: boolean;
};

export type RefundSummary = {
  id: string;
  refundNumber: string;
  orderNumber: string;
  customerName: string | null;
  totalRefundAmount: number | string;
  refundDate: string;
  status: RefundStatus;
};

export type ListRefundsArgs = {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: RefundStatus;
  orderId?: string;
  customerId?: string;
  dateFrom?: string;
  dateTo?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
};

export type ListRefundsResponse = {
  items: RefundSummary[];
  meta: PaginationMeta;
};

export type DailySummaryResult = {
  dateFrom: string;
  dateTo: string;
  warehouseId: string | null;
  warehouseName: string | null;
  totalOrders: number;
  totalSalesAmount: number | string;
  totalTaxAmount: number | string;
  totalDiscountAmount: number | string;
  totalShippingAmount: number | string;
  totalNetAmount: number | string;
  totalPayments: number;
  totalPaymentAmount: number | string;
  totalRefunds: number;
  totalRefundAmount: number | string;
  averageOrderValue: number | string;
  ordersByStatus: Record<string, number>;
  paymentsByMethod: Record<string, { count: number; amount: number | string }>;
  topProducts: {
    productId: string;
    productName: string;
    sku: string;
    quantitySold: number;
    totalRevenue: number | string;
  }[];
  topCustomers: {
    customerId: string;
    customerName: string;
    orderCount: number;
    totalSpent: number | string;
  }[];
};

export type GetDailySummaryArgs = {
  dateFrom: string;
  dateTo: string;
  warehouseId?: string;
};

export type CreditListItem = {
  id: string;
  customerCode: string;
  name: string;
  creditBalance: number | string;
  orderCount: number;
  totalSpent: number | string;
};

export type CreditDetail = CreditListItem & {
  customerId: string;
  creditLimit: number | string;
  availableCredit: number | string;
  currency: string;
  lastTransactionAt: string | null;
  transactions?: CreditTransaction[];
};

export type CreditTransaction = {
  id: string;
  customerId: string;
  type: "PURCHASE" | "PAYMENT" | "REFUND" | "ADJUSTMENT" | "ORDER";
  amount: number | string;
  balanceAfter: number | string;
  reference: string | null;
  orderId: string | null;
  paymentId: string | null;
  notes: string | null;
  createdAt: string;
};

export type ListCreditsArgs = {
  page?: number;
  pageSize?: number;
  search?: string;
  hasBalance?: boolean;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
};

export type ListCreditsResponse = {
  items: CreditListItem[];
  meta: PaginationMeta;
};

export type AdjustCreditRequest = {
  customerId: string;
  adjustmentType: "INCREASE" | "DECREASE" | "SET";
  amount: number;
  reason: string;
  reference?: string;
  notes?: string;
  effectiveDate?: string;
};

export type AdjustCreditResponse = {
  customerId: string;
  customerName: string;
  previousBalance: number | string;
  adjustmentAmount: number | string;
  newBalance: number | string;
  transaction: CreditTransaction;
};

export type ListCreditTransactionsArgs = {
  customerId: string;
  page?: number;
  pageSize?: number;
  type?: CreditTransaction["type"];
  dateFrom?: string;
  dateTo?: string;
};

export type ListCreditTransactionsResponse = {
  items: CreditTransaction[];
  meta: PaginationMeta;
};

export const salesApi = apiSlice.injectEndpoints({
  endpoints: (builder) => ({
    listOrders: builder.query<
      Envelope<ListOrdersResponse>,
      ListOrdersArgs | void
    >({
      query: (args) => ({ url: "/sales/orders", params: args ?? {} }),
      providesTags: ["Orders"],
    }),
    getOrderById: builder.query<Envelope<OrderDetail>, string>({
      query: (id) => ({ url: `/sales/orders/${id}` }),
      providesTags: (_, __, id) => [{ type: "Orders", id }],
    }),
    checkoutOrder: builder.mutation<
      Envelope<CheckoutResponse>,
      CreateOrderCheckoutRequest
    >({
      query: (body) => ({
        url: "/sales/orders/checkout",
        method: "POST",
        body,
      }),
      invalidatesTags: [
        "Orders",
        "Payments",
        "Stock",
        "Products",
        "Reports",
        "Credits",
      ],
    }),
    updateOrderStatus: builder.mutation<
      Envelope<OrderDetail>,
      { id: string; body: UpdateOrderStatusRequest }
    >({
      query: ({ id, body }) => ({
        url: `/sales/orders/${id}/status`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: (_, __, { id }) => [
        "Orders",
        "Reports",
        { type: "Orders", id },
      ],
    }),
    removeOrder: builder.mutation<Envelope<{ ok: true }>, string>({
      query: (id) => ({ url: `/sales/orders/${id}`, method: "DELETE" }),
      invalidatesTags: ["Orders", "Reports"],
    }),

    listPayments: builder.query<
      Envelope<ListPaymentsResponse>,
      ListPaymentsArgs | void
    >({
      query: (args) => ({ url: "/sales/payments", params: args ?? {} }),
      providesTags: ["Payments"],
    }),
    getPaymentById: builder.query<Envelope<PaymentDetail>, string>({
      query: (id) => ({ url: `/sales/payments/${id}` }),
      providesTags: (_, __, id) => [{ type: "Payments", id }],
    }),
    createPayment: builder.mutation<
      Envelope<PaymentDetail>,
      PaymentRequest & { orderId?: string; customerId?: string }
    >({
      query: (body) => ({ url: "/sales/payments", method: "POST", body }),
      invalidatesTags: ["Payments", "Orders", "Reports", "Credits"],
    }),

    listRefunds: builder.query<
      Envelope<ListRefundsResponse>,
      ListRefundsArgs | void
    >({
      query: (args) => ({ url: "/sales/refunds", params: args ?? {} }),
      providesTags: ["Refunds"],
    }),
    getRefundById: builder.query<Envelope<RefundDetail>, string>({
      query: (id) => ({ url: `/sales/refunds/${id}` }),
      providesTags: (_, __, id) => [{ type: "Refunds", id }],
    }),
    createRefund: builder.mutation<
      Envelope<{ refund: RefundDetail }>,
      CreateRefundRequest
    >({
      query: (body) => ({ url: "/sales/refunds", method: "POST", body }),
      invalidatesTags: [
        "Refunds",
        "Orders",
        "Payments",
        "Stock",
        "Reports",
        "Credits",
      ],
    }),

    getDailySummary: builder.query<
      Envelope<DailySummaryResult>,
      GetDailySummaryArgs
    >({
      query: (args) => ({ url: "/sales/reports/daily-summary", params: args }),
      providesTags: ["Reports"],
    }),

    listCredits: builder.query<
      Envelope<ListCreditsResponse>,
      ListCreditsArgs | void
    >({
      query: (args) => ({ url: "/sales/credits", params: args ?? {} }),
      providesTags: ["Credits"],
    }),
    getCreditByCustomerId: builder.query<Envelope<CreditDetail>, string>({
      query: (customerId) => ({
        url: `/sales/credits/customer/${customerId}`,
      }),
      providesTags: (_, __, customerId) => [
        { type: "Credits", id: customerId },
      ],
    }),
    adjustCredit: builder.mutation<
      Envelope<AdjustCreditResponse>,
      AdjustCreditRequest
    >({
      query: (body) => ({
        url: "/sales/credits/adjust",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Credits", "Reports"],
    }),
    listCreditTransactions: builder.query<
      Envelope<ListCreditTransactionsResponse>,
      ListCreditTransactionsArgs
    >({
      query: ({ customerId, ...args }) => ({
        url: `/sales/credits/customer/${customerId}/transactions`,
        params: args,
      }),
      providesTags: ["Credits"],
    }),

    listOrderItemsByOrderId: builder.query<
      Envelope<{ items: OrderItem[] }>,
      string
    >({
      query: (orderId) => ({ url: `/sales/orders/${orderId}/items` }),
      providesTags: (_, __, orderId) => [
        "OrderItems",
        { type: "Orders", id: orderId },
      ],
    }),
  }),
  overrideExisting: false,
});

export const { useListProductsQuery: useGetProductsQuery } = {
  useListProductsQuery,
};

export const {
  useListOrdersQuery,
  useGetOrderByIdQuery,
  useCheckoutOrderMutation,
  useUpdateOrderStatusMutation,
  useRemoveOrderMutation,

  useListPaymentsQuery,
  useGetPaymentByIdQuery,
  useCreatePaymentMutation,

  useListRefundsQuery,
  useGetRefundByIdQuery,
  useCreateRefundMutation,

  useGetDailySummaryQuery,

  useListCreditsQuery,
  useGetCreditByCustomerIdQuery,
  useAdjustCreditMutation,
  useListCreditTransactionsQuery,

  useListOrderItemsByOrderIdQuery,
} = salesApi;
