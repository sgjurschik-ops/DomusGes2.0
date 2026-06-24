import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Logging every SQL query (`log: ['query']`) is useful in local development
// but adds real CPU/IO overhead on every single request in production —
// with hundreds of requests/day this adds up. Only log queries when running
// locally; always log errors, in every environment.
export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'production' ? ['error'] : ['query', 'error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db