import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import * as ocDocumentService from '../services/oc-document.service.js'
import type { OcDocumentType, OcDocumentLinkType } from '../models/oc-document.js'

const DOC_TYPES = [
  'meeting_minutes',
  'financial_statement',
  'resolution',
  'notice',
  'meeting_livestream',
  'meeting_recording',
] as const

const LINK_TYPES = ['google_meet', 'google_drive', 'google_site'] as const

// Roles permitted to publish documents / links.
// mgmt_staff is included so management can post livestream / recording links.
const PUBLISHER_ROLES = ['oc_committee', 'mgmt_staff', 'admin']

export default async function ocDocumentRoutes(fastify: FastifyInstance) {
  // POST /api/oc-documents — upload file-backed document (multipart)
  fastify.post(
    '/api/oc-documents',
    {
      preHandler: [fastify.authenticate, fastify.rbac(PUBLISHER_ROLES)],
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      // Multipart: fields come as objects with .value
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
      const type = parts.type as OcDocumentType
      const year = Number(parts.year)
      const description = parts.description

      if (!title || !type || !year) {
        return reply.status(400).send({ error: 'title, type, and year are required' })
      }

      if (!DOC_TYPES.includes(type as (typeof DOC_TYPES)[number])) {
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
        file,
      )

      return reply.status(201).send(doc)
    },
  )

  // POST /api/oc-documents/link — publish a link-backed document (JSON)
  fastify.post(
    '/api/oc-documents/link',
    {
      preHandler: [fastify.authenticate, fastify.rbac(PUBLISHER_ROLES)],
      schema: {
        body: {
          type: 'object',
          required: ['title', 'type', 'year', 'externalUrl'],
          properties: {
            title: { type: 'string', minLength: 1, maxLength: 200 },
            description: { type: 'string', maxLength: 5000 },
            type: { type: 'string', enum: [...DOC_TYPES] },
            year: { type: 'integer', minimum: 1900, maximum: 2100 },
            externalUrl: { type: 'string', format: 'uri', maxLength: 1024 },
            linkType: { type: 'string', enum: [...LINK_TYPES] },
          },
          additionalProperties: false,
        },
      },
    },
    async (request, reply) => {
      const body = request.body as {
        title: string
        description?: string
        type: OcDocumentType
        year: number
        externalUrl: string
        linkType?: OcDocumentLinkType
      }
      const doc = await ocDocumentService.publishLink(request.user.id, body)
      return reply.status(201).send(doc)
    },
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
    async (request) => {
      const query = request.query as { year?: number; type?: string; page?: number; limit?: number }
      const result = await ocDocumentService.listDocuments(query)
      return result
    },
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
    },
  )

  // DELETE /api/oc-documents/:id — remove document
  fastify.delete(
    '/api/oc-documents/:id',
    {
      preHandler: [fastify.authenticate, fastify.rbac(PUBLISHER_ROLES)],
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
    },
  )
}
