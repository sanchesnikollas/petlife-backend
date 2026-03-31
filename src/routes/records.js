import { prisma } from '../lib/prisma.js';
import { createRecordSchema, updateRecordSchema, recordsQuerySchema } from '../schemas/records.js';
import { uploadToR2, validateUpload } from '../utils/storage.js';
import { AppError } from '../plugins/errorHandler.js';
import multipart from '@fastify/multipart';
import crypto from 'node:crypto';

const MAX_FREE_ATTACHMENTS = 3;

export default async function recordsRoutes(fastify) {
  fastify.register(multipart, {
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB
    },
  });

  const opts = { preHandler: [fastify.verifyPetOwnership] };

  // GET /pets/:petId/records — paginated + filtered
  fastify.get('/pets/:petId/records', opts, async (request) => {
    const parsed = recordsQuerySchema.safeParse(request.query);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid query parameters',
        parsed.error.flatten().fieldErrors);
    }

    const { type, page, limit } = parsed.data;
    const skip = (page - 1) * limit;

    const where = { petId: request.params.petId };
    if (type) {
      where.type = type;
    }

    const [records, total] = await Promise.all([
      prisma.record.findMany({
        where,
        include: { attachments: true },
        orderBy: { date: 'desc' },
        skip,
        take: limit,
      }),
      prisma.record.count({ where }),
    ]);

    return {
      data: records,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  });

  // POST /pets/:petId/records
  fastify.post('/pets/:petId/records', opts, async (request, reply) => {
    const parsed = createRecordSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid input',
        parsed.error.flatten().fieldErrors);
    }

    const record = await prisma.record.create({
      data: {
        petId: request.params.petId,
        date: new Date(parsed.data.date),
        type: parsed.data.type,
        title: parsed.data.title,
        description: parsed.data.description || null,
      },
      include: { attachments: true },
    });

    return reply.status(201).send({ data: record });
  });

  // PATCH /pets/:petId/records/:id
  fastify.patch('/pets/:petId/records/:id', opts, async (request) => {
    const parsed = updateRecordSchema.safeParse(request.body);
    if (!parsed.success) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Invalid input',
        parsed.error.flatten().fieldErrors);
    }

    const existing = await prisma.record.findFirst({
      where: { id: request.params.id, petId: request.params.petId },
    });

    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Record not found');
    }

    const data = { ...parsed.data };
    if (data.date) data.date = new Date(data.date);

    const record = await prisma.record.update({
      where: { id: request.params.id },
      data,
      include: { attachments: true },
    });

    return { data: record };
  });

  // DELETE /pets/:petId/records/:id
  fastify.delete('/pets/:petId/records/:id', opts, async (request) => {
    const existing = await prisma.record.findFirst({
      where: { id: request.params.id, petId: request.params.petId },
    });

    if (!existing) {
      throw new AppError(404, 'NOT_FOUND', 'Record not found');
    }

    // Delete attachments first (cascade should handle this, but be explicit)
    await prisma.attachment.deleteMany({ where: { recordId: request.params.id } });
    await prisma.record.delete({ where: { id: request.params.id } });

    return { data: { message: 'Record removed' } };
  });

  // POST /pets/:petId/records/:id/attachments — upload file
  fastify.post('/pets/:petId/records/:id/attachments', opts, async (request, reply) => {
    const recordId = request.params.id;
    const petId = request.params.petId;

    // Verify record exists and belongs to pet
    const record = await prisma.record.findFirst({
      where: { id: recordId, petId },
    });

    if (!record) {
      throw new AppError(404, 'NOT_FOUND', 'Record not found');
    }

    // Freemium gate: max 3 attachments per pet on FREE plan
    if (request.user.plan === 'FREE') {
      const totalAttachments = await prisma.attachment.count({
        where: {
          record: { petId },
        },
      });

      if (totalAttachments >= MAX_FREE_ATTACHMENTS) {
        throw new AppError(403, 'PLAN_REQUIRED', `Free plan allows a maximum of ${MAX_FREE_ATTACHMENTS} attachments per pet`, {
          feature: 'unlimited_attachments',
          currentPlan: 'FREE',
          requiredPlan: 'PREMIUM',
          currentCount: totalAttachments,
          limit: MAX_FREE_ATTACHMENTS,
        });
      }
    }

    const file = await request.file();

    if (!file) {
      throw new AppError(400, 'BAD_REQUEST', 'No file uploaded');
    }

    const buffer = await file.toBuffer();
    const mimeType = file.mimetype;
    const originalFilename = file.filename;
    const fileSize = buffer.length;

    // Validate file
    const validation = validateUpload(mimeType, fileSize);
    if (!validation.valid) {
      throw new AppError(400, 'INVALID_FILE', validation.error);
    }

    // Generate storage key
    const ext = originalFilename.split('.').pop() || 'bin';
    const uniqueId = crypto.randomUUID();
    const key = `${request.user.id}/records/${recordId}/${uniqueId}.${ext}`;

    // Upload to R2
    const url = await uploadToR2(buffer, key, mimeType);

    // Save attachment record
    const attachment = await prisma.attachment.create({
      data: {
        recordId,
        filename: originalFilename,
        url,
        mimeType,
        size: fileSize,
      },
    });

    return reply.status(201).send({ data: attachment });
  });
}
