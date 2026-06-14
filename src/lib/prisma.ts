import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const globalForPrisma = global as unknown as { prisma: PrismaClient };

let prismaClient: PrismaClient;

if (globalForPrisma.prisma) {
  prismaClient = globalForPrisma.prisma;
} else {
  const connectionString = process.env.DATABASE_URL || '';
  
  // Initialize standard PostgreSQL connection pool
  const pool = new Pool({ connectionString });
  const adapter = new PrismaPg(pool);
  
  // Instantiate PrismaClient passing the driver adapter
  prismaClient = new PrismaClient({ adapter });
  
  if (process.env.NODE_ENV !== 'production') {
    globalForPrisma.prisma = prismaClient;
  }
}

export const prisma = prismaClient;
export default prisma;
