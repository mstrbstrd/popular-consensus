import { PrismaClient } from "@prisma/client";

process.env.DATABASE_URL ??= "postgresql://pc:pc@localhost:5432/popular_consensus";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export * from "@prisma/client";
