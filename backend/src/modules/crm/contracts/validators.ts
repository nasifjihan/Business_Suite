import { z } from "zod";
import { PaginationSchema } from "@/utils/pagination";
import { ContractStatus } from "@prisma/client";

export const CreateContractSchema = z
  .object({
    title: z.string().trim().min(1).max(200),
    customerId: z.string().uuid(),
    status: z.nativeEnum(ContractStatus).optional().default(ContractStatus.DRAFT),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    value: z.coerce.number().default(0),
    signedAt: z.coerce.date().optional(),
    signedById: z.string().uuid().optional(),
    notes: z.string().optional(),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "End date must be greater than or equal to start date",
    path: ["endDate"],
  });
export type CreateContractDto = z.infer<typeof CreateContractSchema>;

export const UpdateContractSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
    customerId: z.string().uuid().optional(),
    status: z.nativeEnum(ContractStatus).optional(),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    value: z.coerce.number().optional(),
    signedAt: z.coerce.date().optional(),
    signedById: z.string().uuid().optional(),
    notes: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return data.endDate >= data.startDate;
      }
      return true;
    },
    {
      message: "End date must be greater than or equal to start date",
      path: ["endDate"],
    },
  );
export type UpdateContractDto = z.infer<typeof UpdateContractSchema>;

export const ListContractsSchema = PaginationSchema.extend({
  status: z.nativeEnum(ContractStatus).optional(),
  customerId: z.string().uuid().optional(),
  startDateFrom: z.coerce.date().optional(),
  endDateTo: z.coerce.date().optional(),
  signedById: z.string().uuid().optional(),
});
export type ListContractsQuery = z.infer<typeof ListContractsSchema>;
