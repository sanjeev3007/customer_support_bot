import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

const connectionString = 'postgresql://postgres:password@localhost:5433/customer_support?schema=public';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function resetPasswords() {
  try {
    const testPassword = '123456';
    const salt = bcrypt.genSaltSync(10);
    const hashedPassword = bcrypt.hashSync(testPassword, salt);

    console.log("=== RESETTING PASSWORDS TO '123456' ===");

    const users = await prisma.user.findMany();
    
    for (const user of users) {
      await prisma.user.update({
        where: { id: user.id },
        data: { password: hashedPassword }
      });
      console.log(`Updated password for user: ${user.email} to '123456'`);
    }

    console.log("Password reset completed successfully!");
  } catch (error) {
    console.error("Error resetting passwords:", error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

resetPasswords();
