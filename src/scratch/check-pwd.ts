import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

const connectionString = 'postgresql://postgres:password@localhost:5433/customer_support?schema=public';
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  try {
    const users = await prisma.user.findMany();
    console.log("=== COMPARING PASSWORD HASHES ===");
    for (const user of users) {
      console.log(`\nUser: ${user.email}`);
      console.log(`Hash: ${user.password}`);
      
      const guesses = ['123456', '12345678', 'password', '1234', 'admin', 'anshu'];
      let found = false;
      for (const guess of guesses) {
        if (bcrypt.compareSync(guess, user.password)) {
          console.log(`  -> Detected password match: "${guess}"`);
          found = true;
          break;
        }
      }
      if (!found) {
        console.log("  -> Did not match any common test passwords.");
      }
    }
  } catch (error) {
    console.error("Error checking passwords:", error);
  } finally {
    await prisma.$disconnect();
    await pool.end();
  }
}

main();
