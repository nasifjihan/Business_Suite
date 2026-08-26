import type { Request } from "express";
import { prisma } from "@/lib/prisma";
import type {
  CreateMovementDto,
  ListMovementsQuery,
  TransferDto,
} from "./validators";
import { MovementType, AuditAction, type PrismaClient } from "@prisma/client";
import {
  applyPagination,
  buildPaginationMeta,
} from "@/utils/pagination";
import { AppError, NotFoundError } from "@/lib/errors";
import { omitSensitive, writeAudit, extractMeta } from "@/middleware/audit";

type TxAwareClient = Omit<PrismaClient, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

const POSITIVE_TYPES: ReadonlySet<MovementType> = new Set([
  MovementType.IN,
  MovementType.TRANSFER_IN,
  MovementType.COUNT,
]);

const NEGATIVE_TYPES: ReadonlySet<MovementType> = new Set([
  MovementType.OUT,
  MovementType.TRANSFER_OUT,
  MovementType.SCRAP,
  MovementType.ADJUST,
]);

function computeDelta(movementType: MovementType, quantity: number): number {
  if (POSITIVE_TYPES.has(movementType)) return +quantity;
  if (NEGATIVE_TYPES.has(movementType)) return -quantity;
  throw new AppError(400, `Unsupported movement type: ${movementType}`);
}

async function createMovementInTx(
  tx: TxAwareClient,
  dto: CreateMovementDto,
  req: Request,
) {
  const meta = extractMeta(req);

  const product = await tx.product.findUnique({ where: { id: dto.productId } });
  if (!product) throw new NotFoundError("Product not found.");

  const warehouse = await tx.warehouse.findUnique({ where: { id: dto.warehouseId } });
  if (!warehouse) throw new NotFoundError("Warehouse not found.");

  const delta = computeDelta(dto.movementType, dto.quantity);

  await tx.stock.upsert({
    where: {
      productId_warehouseId: {
        productId: dto.productId,
        warehouseId: dto.warehouseId,
      },
    },
    create: {
      productId: dto.productId,
      warehouseId: dto.warehouseId,
      quantity: Math.max(delta, 0),
      minimumLevel: 0,
    },
    update: {
      quantity: { increment: delta },
    },
  });

  const afterUpsert = await tx.stock.findUnique({
    where: {
      productId_warehouseId: {
        productId: dto.productId,
        warehouseId: dto.warehouseId,
      },
    },
  });
  const newQty = afterUpsert?.quantity ?? 0;
  if (newQty < 0) {
    throw new AppError(
      422,
      `Insufficient stock. Current qty=${newQty} Requested delta=-${dto.quantity}. Operation rolled back.`,
    );
  }

  const movement = await tx.stockMovement.create({
    data: {
      movementType: dto.movementType,
      productId: dto.productId,
      warehouseId: dto.warehouseId,
      quantity: dto.quantity,
      reference: dto.reference || null,
      note: dto.note || null,
      userId: req.user?.id ?? null,
    },
  });

  await writeAudit(tx as any, {
    userId: req.user?.id,
    action: AuditAction.CREATE,
    entityType: "StockMovement",
    entityId: movement.id,
    afterData: omitSensitive(movement),
    ip: meta.ip,
    ua: meta.ua,
  });

  return movement;
}

export const StockMovementsService = {
  async create(dto: CreateMovementDto, req: Request) {
    const result = await prisma.$transaction(async (tx) => {
      return createMovementInTx(tx, dto, req);
    });
    return result;
  },

  async transfer(dto: TransferDto, req: Request) {
    const result = await prisma.$transaction(async (tx) => {
      const product = await tx.product.findUnique({ where: { id: dto.productId } });
      if (!product) throw new NotFoundError("Product not found.");

      const fromWh = await tx.warehouse.findUnique({ where: { id: dto.fromWarehouseId } });
      if (!fromWh) throw new NotFoundError(`Source warehouse not found.`);

      const toWh = await tx.warehouse.findUnique({ where: { id: dto.toWarehouseId } });
      if (!toWh) throw new NotFoundError(`Destination warehouse not found.`);

      if (dto.fromWarehouseId === dto.toWarehouseId) {
        throw new AppError(400, "Source and destination warehouses must be different.");
      }

      const outMovement = await createMovementInTx(tx, {
        movementType: MovementType.TRANSFER_OUT,
        productId: dto.productId,
        warehouseId: dto.fromWarehouseId,
        quantity: dto.quantity,
        reference: dto.reference,
        note: dto.note,
      }, req);

      const inMovement = await createMovementInTx(tx, {
        movementType: MovementType.TRANSFER_IN,
        productId: dto.productId,
        warehouseId: dto.toWarehouseId,
        quantity: dto.quantity,
        reference: dto.reference,
        note: dto.note,
      }, req);

      return { outMovement, inMovement };
    });

    return result;
  },

  async list(q: ListMovementsQuery) {
    const where: Record<string, unknown> = {};

    if (q.movementType) where.movementType = q.movementType;
    if (q.productId) where.productId = q.productId;
    if (q.warehouseId) where.warehouseId = q.warehouseId;

    if (q.fromDate || q.toDate) {
      where.createdAt = {} as Record<string, unknown>;
      if (q.fromDate) (where.createdAt as Record<string, unknown>).gte = q.fromDate;
      if (q.toDate) (where.createdAt as Record<string, unknown>).lte = q.toDate;
    }

    const orderBy: Record<string, unknown> = q.sortBy
      ? { [q.sortBy]: q.sortOrder }
      : { createdAt: "desc" };

    const { skip, take } = applyPagination({ page: q.page, pageSize: q.pageSize });

    const [totalItems, items] = await Promise.all([
      prisma.stockMovement.count({ where }),
      prisma.stockMovement.findMany({
        where,
        skip,
        take,
        orderBy,
        include: {
          product: true,
          warehouse: true,
          user: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      }),
    ]);

    return { items, meta: buildPaginationMeta({ page: q.page, pageSize: q.pageSize, totalItems }) };
  },

  async getById(id: string) {
    const movement = await prisma.stockMovement.findUnique({
      where: { id },
      include: {
        product: true,
        warehouse: true,
        user: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });
    if (!movement) throw new NotFoundError("Stock movement not found.");
    return movement;
  },
};
