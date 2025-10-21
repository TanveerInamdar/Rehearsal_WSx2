import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

describe('API Tests', () => {
  beforeAll(async () => {
    // Ensure demo project exists
    await prisma.project.upsert({
      where: { publicKey: 'public_demo_key' },
      update: {},
      create: {
        name: 'Demo',
        publicKey: 'public_demo_key',
        secretKey: 'secret_demo_key'
      }
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('POST /api/bugs', () => {
    it('should create bug with correct keys', async () => {
      const payload = {
        title: 'Test Bug',
        steps: '1. Open page\n2. Click button',
        expected: 'Button should work',
        actual: 'Button throws error',
        severity: 'medium',
        url: 'http://localhost:3000/test',
        userAgent: 'test-agent',
        viewport: { width: 1280, height: 800 },
        projectPublicKey: 'public_demo_key'
      };

      const response = await fetch('http://localhost:8787/api/bugs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-bugger-key': 'secret_demo_key'
        },
        body: JSON.stringify(payload)
      });

      expect(response.status).toBe(201);
      const data = await response.json();
      expect(data).toHaveProperty('id');
      expect(data.status).toBe('queued');
    });

    it('should return 401 with wrong key', async () => {
      const payload = {
        title: 'Test Bug',
        steps: 'Test',
        expected: 'Test',
        actual: 'Test',
        severity: 'low',
        url: 'http://test.com',
        userAgent: 'test',
        viewport: { width: 100, height: 100 },
        projectPublicKey: 'public_demo_key'
      };

      const response = await fetch('http://localhost:8787/api/bugs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-bugger-key': 'wrong_key'
        },
        body: JSON.stringify(payload)
      });

      expect(response.status).toBe(401);
    });

    it('should return 401 with missing key', async () => {
      const payload = {
        title: 'Test Bug',
        steps: 'Test',
        expected: 'Test',
        actual: 'Test',
        severity: 'low',
        url: 'http://test.com',
        userAgent: 'test',
        viewport: { width: 100, height: 100 },
        projectPublicKey: 'public_demo_key'
      };

      const response = await fetch('http://localhost:8787/api/bugs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/bugs', () => {
    it('should filter by status', async () => {
      const response = await fetch('http://localhost:8787/api/bugs?status=queued', {
        headers: {
          'x-bugger-key': 'secret_demo_key'
        }
      });

      expect(response.status).toBe(200);
      const bugs = await response.json();
      expect(Array.isArray(bugs)).toBe(true);
      // All bugs should have status 'queued' if any exist
      bugs.forEach((bug: any) => {
        expect(bug.status).toBe('queued');
      });
    });

    it('should return 401 without auth', async () => {
      const response = await fetch('http://localhost:8787/api/bugs');
      expect(response.status).toBe(401);
    });
  });
});

