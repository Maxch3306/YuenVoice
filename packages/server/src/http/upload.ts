import type { Env } from '../env.js'
import { HttpError } from './errors.js'

// Magic-byte validation (declared mimetype is ignored — detected type wins),
// carried over from the Fastify upload plugin. Files are stored in R2 instead
// of local disk; the object key scheme is unchanged: {entity}/{yyyy-mm}/{uuid}.{ext}.
const MAGIC_BYTES: Record<string, { bytes: number[]; offset: number }[]> = {
  'image/jpeg': [{ bytes: [0xff, 0xd8, 0xff], offset: 0 }],
  'image/png': [{ bytes: [0x89, 0x50, 0x4e, 0x47], offset: 0 }],
  'image/webp': [{ bytes: [0x52, 0x49, 0x46, 0x46], offset: 0 }], // RIFF
  'application/pdf': [{ bytes: [0x25, 0x50, 0x44, 0x46], offset: 0 }], // %PDF
}
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
}
const ALLOWED_MIMETYPES = new Set(Object.keys(MIME_TO_EXT))

function detectMimeType(buf: Uint8Array): string | null {
  for (const [mime, signatures] of Object.entries(MAGIC_BYTES)) {
    for (const sig of signatures) {
      if (sig.bytes.every((byte, i) => buf[sig.offset + i] === byte)) return mime
    }
  }
  return null
}

export interface SaveFileResult {
  filePath: string
  fileType: string
  fileSize: number
}

// Validate and store an uploaded file in R2. `data` is the raw bytes (from a
// Workers `File`/`FormData` entry via `.arrayBuffer()`).
export async function saveFile(
  env: Env,
  data: ArrayBuffer | Uint8Array,
  entity: string,
): Promise<SaveFileResult> {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
  const fileSize = bytes.byteLength

  const maxSize = Number(env.UPLOAD_MAX_SIZE) || 10_485_760
  if (fileSize > maxSize) throw new HttpError(400, 'File too large')

  const detectedMime = detectMimeType(bytes)
  if (!detectedMime || !ALLOWED_MIMETYPES.has(detectedMime)) {
    throw new HttpError(400, 'Invalid file type. Allowed: JPEG, PNG, WebP, PDF')
  }

  const ext = MIME_TO_EXT[detectedMime]
  const now = new Date()
  const yearMonth = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`
  const key = `${entity}/${yearMonth}/${crypto.randomUUID()}.${ext}`

  await env.UPLOADS.put(key, bytes, { httpMetadata: { contentType: detectedMime } })

  return { filePath: key, fileType: detectedMime, fileSize }
}
