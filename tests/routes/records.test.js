import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { buildApp } from '../../src/server.js';
import { prisma } from '../setup.js';
import { createTestUser } from '../factories/user.js';
import { createTestPet } from '../factories/pet.js';
import { signAccessToken } from '../../src/utils/jwt.js';
import FormData from 'form-data';

describe('Records Routes', () => {
  let app, user, pet;

  beforeEach(async () => {
    app = buildApp({ logger: false });
    await app.ready();
    user = await createTestUser({ email: 'records@example.com' });
    pet = await createTestPet(user.id, { name: 'Rex' });
  });

  afterEach(async () => {
    await app.close();
  });

  function headers(overrideUser) {
    const u = overrideUser || user;
    const token = signAccessToken({ id: u.id, email: u.email, plan: u.plan });
    return { authorization: `Bearer ${token}` };
  }

  describe('POST /pets/:petId/records', () => {
    it('should create a record', async () => {
      const res = await app.inject({
        method: 'POST',
        url: `/pets/${pet.id}/records`,
        headers: headers(),
        payload: {
          date: '2026-03-20T10:00:00.000Z',
          type: 'EXAM',
          title: 'Exame de sangue completo',
          description: 'Hemograma + bioquimico',
        },
      });

      expect(res.statusCode).toBe(201);

      const body = JSON.parse(res.payload);
      expect(body.data.title).toBe('Exame de sangue completo');
      expect(body.data.type).toBe('EXAM');
      expect(body.data.attachments).toEqual([]);
    });
  });

  describe('GET /pets/:petId/records', () => {
    it('should return paginated records', async () => {
      // Create 25 records
      for (let i = 0; i < 25; i++) {
        await prisma.record.create({
          data: {
            petId: pet.id,
            date: new Date(`2026-03-${String(i + 1).padStart(2, '0')}`),
            type: 'NOTE',
            title: `Record ${i + 1}`,
          },
        });
      }

      // Page 1
      const res1 = await app.inject({
        method: 'GET',
        url: `/pets/${pet.id}/records?page=1&limit=10`,
        headers: headers(),
      });

      const body1 = JSON.parse(res1.payload);
      expect(body1.data).toHaveLength(10);
      expect(body1.meta.total).toBe(25);
      expect(body1.meta.totalPages).toBe(3);
      expect(body1.meta.page).toBe(1);

      // Page 3
      const res3 = await app.inject({
        method: 'GET',
        url: `/pets/${pet.id}/records?page=3&limit=10`,
        headers: headers(),
      });

      const body3 = JSON.parse(res3.payload);
      expect(body3.data).toHaveLength(5);
    });

    it('should filter records by type', async () => {
      await prisma.record.createMany({
        data: [
          { petId: pet.id, date: new Date(), type: 'VACCINE', title: 'V10' },
          { petId: pet.id, date: new Date(), type: 'EXAM', title: 'Blood test' },
          { petId: pet.id, date: new Date(), type: 'VACCINE', title: 'Rabies' },
        ],
      });

      const res = await app.inject({
        method: 'GET',
        url: `/pets/${pet.id}/records?type=VACCINE`,
        headers: headers(),
      });

      const body = JSON.parse(res.payload);
      expect(body.data).toHaveLength(2);
      expect(body.data.every(r => r.type === 'VACCINE')).toBe(true);
    });
  });

  describe('PATCH /pets/:petId/records/:id', () => {
    it('should update a record', async () => {
      const record = await prisma.record.create({
        data: {
          petId: pet.id,
          date: new Date(),
          type: 'NOTE',
          title: 'Original title',
        },
      });

      const res = await app.inject({
        method: 'PATCH',
        url: `/pets/${pet.id}/records/${record.id}`,
        headers: headers(),
        payload: {
          title: 'Updated title',
          description: 'Added description',
        },
      });

      expect(res.statusCode).toBe(200);

      const body = JSON.parse(res.payload);
      expect(body.data.title).toBe('Updated title');
      expect(body.data.description).toBe('Added description');
    });
  });

  describe('DELETE /pets/:petId/records/:id', () => {
    it('should delete a record', async () => {
      const record = await prisma.record.create({
        data: {
          petId: pet.id,
          date: new Date(),
          type: 'NOTE',
          title: 'To delete',
        },
      });

      const res = await app.inject({
        method: 'DELETE',
        url: `/pets/${pet.id}/records/${record.id}`,
        headers: headers(),
      });

      expect(res.statusCode).toBe(200);

      const count = await prisma.record.count({ where: { petId: pet.id } });
      expect(count).toBe(0);
    });

    it('should return 404 for non-existent record', async () => {
      const res = await app.inject({
        method: 'DELETE',
        url: `/pets/${pet.id}/records/non-existent`,
        headers: headers(),
      });

      expect(res.statusCode).toBe(404);
    });
  });

  describe('POST /pets/:petId/records/:id/attachments', () => {
    it('should upload an attachment (mock R2)', async () => {
      const record = await prisma.record.create({
        data: {
          petId: pet.id,
          date: new Date(),
          type: 'EXAM',
          title: 'Blood test',
        },
      });

      const formData = new FormData();
      const fakeFile = Buffer.from('fake-pdf-content');
      formData.append('file', fakeFile, {
        filename: 'exam-result.pdf',
        contentType: 'application/pdf',
      });

      const res = await app.inject({
        method: 'POST',
        url: `/pets/${pet.id}/records/${record.id}/attachments`,
        headers: {
          ...headers(),
          ...formData.getHeaders(),
        },
        payload: formData,
      });

      expect(res.statusCode).toBe(201);

      const body = JSON.parse(res.payload);
      expect(body.data.filename).toBe('exam-result.pdf');
      expect(body.data.mimeType).toBe('application/pdf');
      expect(body.data.url).toContain('cdn.petlife.app');
    });

    it('should enforce freemium limit of 3 attachments per pet', async () => {
      // Create 3 attachments on different records
      for (let i = 0; i < 3; i++) {
        const record = await prisma.record.create({
          data: {
            petId: pet.id,
            date: new Date(),
            type: 'EXAM',
            title: `Exam ${i}`,
          },
        });

        await prisma.attachment.create({
          data: {
            recordId: record.id,
            filename: `file${i}.pdf`,
            url: `https://cdn.petlife.app/test/${i}.pdf`,
            mimeType: 'application/pdf',
            size: 1000,
          },
        });
      }

      // Try to upload a 4th
      const newRecord = await prisma.record.create({
        data: {
          petId: pet.id,
          date: new Date(),
          type: 'EXAM',
          title: 'Another exam',
        },
      });

      const formData = new FormData();
      const fakeFile = Buffer.from('fake-content');
      formData.append('file', fakeFile, {
        filename: 'blocked.pdf',
        contentType: 'application/pdf',
      });

      const res = await app.inject({
        method: 'POST',
        url: `/pets/${pet.id}/records/${newRecord.id}/attachments`,
        headers: {
          ...headers(),
          ...formData.getHeaders(),
        },
        payload: formData,
      });

      expect(res.statusCode).toBe(403);

      const body = JSON.parse(res.payload);
      expect(body.error.code).toBe('PLAN_REQUIRED');
      expect(body.error.fields.feature).toBe('unlimited_attachments');
    });

    it('should allow PREMIUM users unlimited attachments', async () => {
      const premiumUser = await createTestUser({ email: 'premium-rec@example.com', plan: 'PREMIUM' });
      const premiumPet = await createTestPet(premiumUser.id, { name: 'Luna' });

      // Create 3 existing attachments
      for (let i = 0; i < 3; i++) {
        const record = await prisma.record.create({
          data: {
            petId: premiumPet.id,
            date: new Date(),
            type: 'EXAM',
            title: `Exam ${i}`,
          },
        });

        await prisma.attachment.create({
          data: {
            recordId: record.id,
            filename: `file${i}.pdf`,
            url: `https://cdn.petlife.app/test/${i}.pdf`,
            mimeType: 'application/pdf',
            size: 1000,
          },
        });
      }

      // 4th upload should succeed
      const newRecord = await prisma.record.create({
        data: {
          petId: premiumPet.id,
          date: new Date(),
          type: 'EXAM',
          title: 'Extra exam',
        },
      });

      const formData = new FormData();
      const fakeFile = Buffer.from('premium-content');
      formData.append('file', fakeFile, {
        filename: 'premium.pdf',
        contentType: 'application/pdf',
      });

      const res = await app.inject({
        method: 'POST',
        url: `/pets/${premiumPet.id}/records/${newRecord.id}/attachments`,
        headers: {
          ...headers(premiumUser),
          ...formData.getHeaders(),
        },
        payload: formData,
      });

      expect(res.statusCode).toBe(201);
    });
  });
});
