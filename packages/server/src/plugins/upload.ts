import fp from 'fastify-plugin'
import multipart from '@fastify/multipart'
import type { FastifyInstance } from 'fastify'
import type { MultipartFile } from '@fastify/multipart'
import { randomUUID } from 'node:crypto'
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { config } from '../config/index.js'

// Magic bytes for allowed file types
const MAGIC_BYTES: Record<string, { bytes: number[]; offset: number }[]> = {
  'image/jpeg': [{ bytes: [0xff, 0xd8, 0xff], offset: 0 }],
  'image/png': [{ bytes: [0x89, 0x50, 0x4e, 0x47], offset: 0 }],
  'image/webp': [{ bytes: [0x52, 0x49, 0x46, 0x46], offset: 0 }], // RIFF header
  'application/pdf': [{ bytes: [0x25, 0x50, 0x44, 0x46], offset: 0 }], // %PDF
}

const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
}

const ALLOWED_MIMETYPES = new Set(Object.keys(MIME_TO_EXT))

function detectMimeType(buffer: Buffer): string | null {
  for (const [mime, signatures] of Object.entries(MAGIC_BYTES)) {
    for (const sig of signatures) {
      const match = sig.bytes.every((byte, i) => buffer[sig.offset + i] === byte)
      if (match) return mime
    }
  }
  return null
}

export interface SaveFileResult {
  filePath: string
  fileType: string
  fileSize: number
}

export async function saveFile(file: MultipartFile, entity: string): Promise<SaveFileResult> {
  const buffer = await file.toBuffer()
  const fileSize = buffer.length

  if (fileSize > config.uploadMaxSize) {
    throw Object.assign(new Error('File too large'), { statusCode: 400 })
  }

  // Validate by magic bytes
  const detectedMime = detectMimeType(buffer)
  if (!detectedMime || !ALLOWED_MIMETYPES.has(detectedMime)) {
    throw Object.assign(
      new Error('Invalid file type. Allowed: JPEG, PNG, WebP, PDF'),
      { statusCode: 400 }
    )
  }

  const ext = MIME_TO_EXT[detectedMime]
  const now = new Date()
  const yearMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const uuid = randomUUID()
  const relativePath = path.posix.join(entity, yearMonth, `${uuid}.${ext}`)
  const absolutePath = path.join(config.uploadDir, entity, yearMonth, `${uuid}.${ext}`)

  await mkdir(path.dirname(absolutePath), { recursive: true })
  await writeFile(absolutePath, buffer)

  return {
    filePath: relativePath,
    fileType: detectedMime,
    fileSize,
  }
}

export default fp(
  async function uploadPlugin(fastify: FastifyInstance) {
    await fastify.register(multipart, {
      limits: {
        fileSize: config.uploadMaxSize, // 10MB default
        files: 5,
      },
    })
  },
  {
    name: 'upload-plugin',
    dependencies: [],
  }
)
