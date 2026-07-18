import { and, desc, eq, sql } from 'drizzle-orm'
import type { Db } from '../../db/client.js'
import type { Env } from '../../env.js'
import { ocDocuments, notifications, userNotifications, users } from '../../db/schema.js'
import { parsePagination, paginatedResponse } from '../../utils/pagination.js'
import { logAudit } from '../audit.js'
import { saveFile } from '../upload.js'
import { sanitizeText } from '../sanitize.js'
import { HttpError } from '../errors.js'

type OcDocumentType =
  | 'meeting_minutes'
  | 'financial_statement'
  | 'resolution'
  | 'notice'
  | 'meeting_livestream'
  | 'meeting_recording'
type OcDocumentLinkType = 'google_meet' | 'google_drive' | 'google_site'

export interface PublishDocumentData {
  title: string
  description?: string
  type: OcDocumentType
  year: number
}

export interface ListDocumentFilters {
  year?: number
  type?: string
  page?: string | number
  limit?: string | number
}

const publisherCols = { id: users.id, name: users.name, email: users.email }

// Infer link_type from URL host when caller didn't specify.
function inferLinkType(url: string): OcDocumentLinkType {
  try {
    const host = new URL(url).hostname.toLowerCase()
    if (host.includes('meet.google.com')) return 'google_meet'
    if (host.includes('sites.google.com')) return 'google_site'
    // drive.google.com, docs.google.com, etc.
    return 'google_drive'
  } catch {
    return 'google_drive'
  }
}

/**
 * Publish a document backed by an uploaded file (PDF/image, stored in R2).
 */
export async function uploadDocument(
  db: Db,
  env: Env,
  publisherId: string,
  data: PublishDocumentData,
  file: ArrayBuffer | Uint8Array,
) {
  const { filePath } = await saveFile(env, file, 'oc-documents')

  const [doc] = await db
    .insert(ocDocuments)
    .values({
      publisher_id: publisherId,
      title: sanitizeText(data.title),
      description: data.description ? sanitizeText(data.description) : null,
      type: data.type,
      year: data.year,
      file_path: filePath,
      external_url: null,
      link_type: null,
    })
    .returning()

  await notifyResidents(db, publisherId, data.title)
  return doc
}

/**
 * Publish a document backed by an external link (Google Meet/Drive/Sites).
 */
export async function publishLink(
  db: Db,
  publisherId: string,
  data: PublishDocumentData & { externalUrl: string; linkType?: OcDocumentLinkType },
) {
  // Reject non-http(s) URLs defensively.
  let parsed: URL
  try {
    parsed = new URL(data.externalUrl)
  } catch {
    throw new HttpError(400, 'Invalid URL')
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new HttpError(400, 'URL must be http(s)')
  }

  const [doc] = await db
    .insert(ocDocuments)
    .values({
      publisher_id: publisherId,
      title: sanitizeText(data.title),
      description: data.description ? sanitizeText(data.description) : null,
      type: data.type,
      year: data.year,
      file_path: null,
      external_url: data.externalUrl,
      link_type: data.linkType ?? inferLinkType(data.externalUrl),
    })
    .returning()

  await notifyResidents(db, publisherId, data.title)
  return doc
}

async function notifyResidents(db: Db, publisherId: string, title: string): Promise<void> {
  try {
    const [notification] = await db
      .insert(notifications)
      .values({
        sender_id: publisherId,
        title: '新法團文件',
        body: `已發佈新文件：${title}`,
        category: 'general',
        target_type: 'all',
      })
      .returning({ id: notifications.id })

    const allUsers = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.is_active, true))

    if (allUsers.length > 0) {
      await db
        .insert(userNotifications)
        .values(allUsers.map((u) => ({ notification_id: notification.id, user_id: u.id })))
    }
  } catch {
    // Fire-and-forget: do not fail the publish if notification fails.
  }
}

export async function listDocuments(db: Db, filters: ListDocumentFilters) {
  const { offset, limit } = parsePagination({ page: filters.page, limit: filters.limit })
  const page = Number(filters.page) || 1

  const conditions = []
  if (filters.year) conditions.push(eq(ocDocuments.year, filters.year))
  if (filters.type) conditions.push(eq(ocDocuments.type, filters.type as OcDocumentType))
  const where = conditions.length ? and(...conditions) : undefined

  const rows = await db.query.ocDocuments.findMany({
    where,
    with: { publisher: { columns: { id: true, name: true, email: true } } },
    orderBy: desc(ocDocuments.created_at),
    limit,
    offset,
  })
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(ocDocuments)
    .where(where)

  return paginatedResponse(rows, Number(count), page, limit)
}

export async function getDocumentById(db: Db, docId: string) {
  const doc = await db.query.ocDocuments.findFirst({
    where: eq(ocDocuments.id, docId),
    with: { publisher: { columns: { id: true, name: true, email: true } } },
  })
  return doc ?? null
}

export async function removeDocument(db: Db, env: Env, docId: string, userId: string) {
  const [doc] = await db.select().from(ocDocuments).where(eq(ocDocuments.id, docId)).limit(1)
  if (!doc) {
    throw new HttpError(404, 'Document not found')
  }

  // Only attempt to remove the stored object if this document is file-backed.
  if (doc.file_path) {
    try {
      await env.UPLOADS.delete(doc.file_path)
    } catch {
      // Object may already be missing — continue.
    }
  }

  await db.delete(ocDocuments).where(eq(ocDocuments.id, docId))

  await logAudit(db, userId, 'delete', 'oc_document', docId, {
    title: doc.title,
    type: doc.type,
  })
}
