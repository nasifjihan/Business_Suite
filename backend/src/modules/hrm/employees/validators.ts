import { z } from "zod";
import { PaginationSchema } from "@/utils/pagination";
import { EmploymentType, EmployeeStatus } from "@prisma/client";

export const CreateEmployeeSchema = z.object({
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  email: z.string().trim().email().optional().or(z.literal("")),
  phone: z.string().trim().optional(),
  mobile: z.string().trim().optional(),
  dateOfBirth: z.coerce.date().optional(),
  joiningDate: z.coerce.date(),
  resignationDate: z.coerce.date().optional(),
  departmentId: z.string().uuid().optional(),
  designationId: z.string().uuid().optional(),
  managerId: z.string().uuid().optional(),
  employmentType: z.nativeEnum(EmploymentType).optional().default(EmploymentType.FULL_TIME),
  status: z.nativeEnum(EmployeeStatus).optional().default(EmployeeStatus.ACTIVE),
  basicSalary: z.coerce.number().gte(0).default(0),
  address: z.string().trim().optional(),
  city: z.string().trim().optional(),
  country: z.string().trim().optional(),
  emergencyName: z.string().trim().optional(),
  emergencyPhone: z.string().trim().optional(),
  emergencyRelation: z.string().trim().optional(),
  imageUrl: z.string().trim().optional(),
  notes: z.string().trim().optional(),
}).strict();
export type CreateEmployeeDto = z.infer<typeof CreateEmployeeSchema>;

export const UpdateEmployeeSchema = z.object({
  firstName: z.string().trim().min(1).optional(),
  lastName: z.string().trim().min(1).optional(),
  email: z.string().trim().email().optional().or(z.literal("")),
  phone: z.string().trim().optional(),
  mobile: z.string().trim().optional(),
  dateOfBirth: z.coerce.date().optional(),
  joiningDate: z.coerce.date().optional(),
  resignationDate: z.coerce.date().optional().nullable(),
  departmentId: z.string().uuid().optional().nullable(),
  designationId: z.string().uuid().optional().nullable(),
  managerId: z.string().uuid().optional().nullable(),
  employmentType: z.nativeEnum(EmploymentType).optional(),
  status: z.nativeEnum(EmployeeStatus).optional(),
  basicSalary: z.coerce.number().gte(0).optional(),
  address: z.string().trim().optional(),
  city: z.string().trim().optional(),
  country: z.string().trim().optional(),
  emergencyName: z.string().trim().optional(),
  emergencyPhone: z.string().trim().optional(),
  emergencyRelation: z.string().trim().optional(),
  imageUrl: z.string().trim().optional(),
  notes: z.string().trim().optional(),
}).strict();
export type UpdateEmployeeDto = z.infer<typeof UpdateEmployeeSchema>;

export const ListEmployeesSchema = PaginationSchema.extend({
  search: z.string().optional(),
  departmentId: z.string().uuid().optional(),
  designationId: z.string().uuid().optional(),
  status: z.nativeEnum(EmployeeStatus).optional(),
  isActive: z.coerce.boolean().optional(),
  employmentType: z.nativeEnum(EmploymentType).optional(),
  sortBy: z.enum(["employeeCode", "firstName", "lastName", "joiningDate", "status", "createdAt"]).optional(),
}).strip();
export type ListEmployeesQuery = z.infer<typeof ListEmployeesSchema>;
