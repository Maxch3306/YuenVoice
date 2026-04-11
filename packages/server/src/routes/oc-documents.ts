import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import * as ocDocumentService from '../services/oc-document.service.js'

const DOC_TYPES = ['meeting_minutes', 'financial_statement', 'resolution', 'notice'] as const

export default async function ocDocumentRoutes(fastify: FastifyInstance) {
  // POST /api/oc-documents — upload document (OC committee / admin)
  fastify.post(
    '/api/oc-documents',
    {
      preHandler: [fastify.authenticate, fastify.rbac(['oc_committee', 'admin'])],
      schema: {
        description: 'Upload an OC document',
        response: {
          201: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              type: { type: 'string' },
              year: { type: 'integer' },
              file_path: { type: 'string' },
              created_at: { type: 'string' },
            },
          },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const data = request.body as any

      // For multipart, fields come as objects with .value
      const parts: Record<string, string> = {}
      let file: { buffer: Buffer; mimetype: string; filename: string } | null = null

      for await (const part of request.parts()) {
        if (part.type === 'file') {
          const buffer = await part.toBuffer()
          file = { buffer, mimetype: part.mimetype, filename: part.filename }
        } else {
          parts[(part as any).fieldname] = (part as any).value
        }
      }

      if (!file) {
        return reply.status(400).send({ error: 'File is required' })
      }

      const title = parts.title
      const type = parts.type as typeof DOC_TYPES[number]
      const year = Number(parts.year)
      const description = parts.description

      if (!title || !type || !year) {
        return reply.status(400).send({ error: 'title, type, and year are required' })
      }

      if (!DOC_TYPES.includes(type)) {
        return reply.status(400).send({
          error: `type must be one of: ${DOC_TYPES.join(', ')}`,
        })
      }

      if (isNaN(year) || year < 1900 || year > 2100) {
        return reply.status(400).send({ error: 'year must be a valid year' })
      }

      const doc = await ocDocumentService.uploadDocument(
        request.user.id,
        { title, description, type, year },
        file
      )

      return reply.status(201).send(doc)
    }
  )

  // GET /api/oc-documents — list documents (all authenticated users)
  fastify.get(
    '/api/oc-documents',
    {
      preHandler: [fastify.authenticate],
      schema: {
        querystring: {
          type: 'object',
          properties: {
            year: { type: 'integer' },
            type: { type: 'string', enum: [...DOC_TYPES] },
            page: { type: 'integer', minimum: 1, default: 1 },
            limit: { type: 'integer', minimum: 1, maximum: 100, default: 20 },
          },
        },
      },
    },
    async (request, reply) => {
      const query = request.query as { year?: number; type?: string; page?: number; limit?: number }
      const result = await ocDocumentService.listDocuments(query)
      return result
    }
  )

  // GET /api/oc-documents/:id — document detail
  fastify.get(
    '/api/oc-documents/:id',
    {
      preHandler: [fastify.authenticate],
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      const doc = await ocDocumentService.getDocumentById(id)
      if (!doc) {
        return reply.status(404).send({ error: 'Document not found' })
      }
      return doc
    }
  )

  // DELETE /api/oc-documents/:id — remove document (OC committee / admin)
  fastify.delete(
    '/api/oc-documents/:id',
    {
      preHandler: [fastify.authenticate, fastify.rbac(['oc_committee', 'admin'])],
      schema: {
        params: {
          type: 'object',
          required: ['id'],
          properties: {
            id: { type: 'string', format: 'uuid' },
          },
        },
      },
    },
    async (request, reply) => {
      const { id } = request.params as { id: string }
      await ocDocumentService.removeDocument(id, request.user.id)
      return { message: 'Document deleted' }
    }
  )
}
