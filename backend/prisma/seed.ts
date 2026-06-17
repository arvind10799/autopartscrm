import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();
const SALT_ROUNDS = 12;
const DEFAULT_PASSWORD = process.env.SEED_USER_PASSWORD ?? 'Password123!';

const seedUsers = [
  {
    email: 'admin@autopartscrm.local',
    name: 'Admin User',
    role: Role.ADMIN,
  },
  {
    email: 'sales@autopartscrm.local',
    name: 'Sales User',
    role: Role.SALES,
  },
  {
    email: 'shipping@autopartscrm.local',
    name: 'Shipping User',
    role: Role.SHIPPING,
  },
] as const;

async function main() {
  const passwordHash = await bcrypt.hash(DEFAULT_PASSWORD, SALT_ROUNDS);

  for (const user of seedUsers) {
    await prisma.user.upsert({
      where: {
        email: user.email,
      },
      update: {
        name: user.name,
        role: user.role,
        passwordHash,
      },
      create: {
        email: user.email,
        name: user.name,
        role: user.role,
        passwordHash,
      },
    });
  }

  console.log('Seeded login users:');
  for (const user of seedUsers) {
    console.log(`- ${user.role}: ${user.email}`);
  }
  console.log(`Shared password: ${DEFAULT_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error('Failed to seed users.', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
