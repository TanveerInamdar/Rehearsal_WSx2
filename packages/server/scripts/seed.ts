import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const prisma = new PrismaClient();

async function seed() {
  try {
    console.log('🌱 Starting database seed...');

    // Check if demo project already exists
    const existingProject = await prisma.project.findUnique({
      where: { publicKey: 'public_demo_key' }
    });

    if (existingProject) {
      console.log('✅ Demo project already exists:');
      console.log(`   Project ID: ${existingProject.id}`);
      console.log(`   Public Key: ${existingProject.publicKey}`);
      console.log(`   Secret Key: ${existingProject.secretKey}`);
      return;
    }

    // Create demo project
    const demoProject = await prisma.project.create({
      data: {
        name: 'Demo',
        publicKey: 'public_demo_key',
        secretKey: 'secret_demo_key'
      }
    });

    console.log('✅ Demo project created successfully!');
    console.log(`   Project ID: ${demoProject.id}`);
    console.log(`   Public Key: ${demoProject.publicKey}`);
    console.log(`   Secret Key: ${demoProject.secretKey}`);
    console.log('');
    console.log('🔑 Use these keys in your snippet and API calls:');
    console.log(`   Public Key: ${demoProject.publicKey}`);
    console.log(`   Secret Key: ${demoProject.secretKey}`);

  } catch (error) {
    console.error('❌ Error seeding database:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the seed function
seed();
