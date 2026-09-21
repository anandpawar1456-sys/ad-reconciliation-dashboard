import { PrismaClient } from "@prisma/client";

// Reuse the client across hot reloads in dev and across warm serverless
// invocations on Vercel, instead of opening a new pool connection per call.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
