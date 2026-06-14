import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:password@localhost:5433/customer_support?schema=public';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function checkUsers() {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true
      }
    });
    console.log("=== USERS REGISTERED IN DATABASE ===");
    if (users.length === 0) {
      console.log("No users found in the database. The database is empty.");
    } else {
      console.log(JSON.stringify(users, null, 2));
    }
  } catch (error) {
    console.error("Error querying users from database:", error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

checkUsers();
