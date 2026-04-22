import { OcDocument, User, Notification, UserNotification } from '../models/index.js'
import type { OcDocumentType, OcDocumentLinkType } from '../models/oc-document.js'
import { saveFile, type FileInput } from '../plugins/upload.js'
import { parsePagination, paginatedResponse, type PaginatedResponse } from '../utils/pagination.js'
import { logAudit } from '../utils/audit.js'
import { unlink } from 'node:fs/promises'
import path from 'node:path'
import { config } from '../config/index.js'
import { sanitizeText } from '../utils/sanitize.js'

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
 * Publish a document backed by an uploaded file.
 */
export async function uploadDocument(
  publisherId: string,
  data: PublishDocumentData,
  file: FileInput,
): Promise<OcDocument> {
  const { filePath } = await saveFile(file, 'oc-documents')

  const doc = await OcDocument.create({
    publisher_id: publisherId,
    title: sanitizeText(data.title),
    description: data.description ? sanitizeText(data.description) : null,
    type: data.type,
    year: data.year,
    file_path: filePath,
    external_url: null,
    link_type: null,
  })

  await notifyResidents(publisherId, data.title)
  return doc
}

/**
 * Publish a document backed by an external link (Google Meet/Drive/Sites).
 */
export async function publishLink(
  publisherId: string,
  data: PublishDocumentData & { externalUrl: string; linkType?: OcDocumentLinkType },
): Promise<OcDocument> {
  // Reject non-http(s) URLs defensively.
  let parsed: URL
  try {
    parsed = new URL(data.externalUrl)
  } catch {
    throw Object.assign(new Error('Invalid URL'), { statusCode: 400 })
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw Object.assign(new Error('URL must be http(s)'), { statusCode: 400 })
  }

  const doc = await OcDocument.create({
    publisher_id: publisherId,
    title: sanitizeText(data.title),
    description: data.description ? sanitizeText(data.description) : null,
    type: data.type,
    year: data.year,
    file_path: null,
    external_url: data.externalUrl,
    link_type: data.linkType ?? inferLinkType(data.externalUrl),
  })

  await notifyResidents(publisherId, data.title)
  return doc
}

async function notifyResidents(publisherId: string, title: string): Promise<void> {
  try {
    const notification = await Notification.create({
      sender_id: publisherId,
      title: '新法團文件',
      body: `已發佈新文件：${title}`,
      category: 'general',
      target_type: 'all',
    })

    const allUsers = await User.findAll({
      where: { is_active: true },
      attributes: ['id'],
    })

    if (allUsers.length > 0) {
      await UserNotification.bulkCreate(
        allUsers.map((u) => ({
          notification_id: notification.id,
          user_id: u.id,
        })),
      )
    }
  } catch {
    // Fire-and-forget: do not fail the publish if notification fails.
  }
}

export async function listDocuments(
  filters: ListDocumentFilters,
): Promise<PaginatedResponse<OcDocument>> {
  const { offset, limit } = parsePagination(filters)
  const page = Number(filters.page) || 1

  const where: Record<string, unknown> = {}
  if (filters.year) where.year = filters.year
  if (filters.type) where.type = filters.type

  const { rows, count } = await OcDocument.findAndCountAll({
    where,
    include: [
      {
        model: User,
        as: 'publisher',
        attributes: ['id', 'name', 'email'],
      },
    ],
    order: [['created_at', 'DESC']],
    offset,
    limit,
  })

  return paginatedResponse(rows, count, page, limit)
}

export async function getDocumentById(docId: string): Promise<OcDocument | null> {
  return OcDocument.findByPk(docId, {
    include: [
      {
        model: User,
        as: 'publisher',
        attributes: ['id', 'name', 'email'],
      },
    ],
  })
}

export async function removeDocument(docId: string, userId: string): Promise<void> {
  const doc = await OcDocument.findByPk(docId)
  if (!doc) {
    throw Object.assign(new Error('Document not found'), { statusCode: 404 })
  }

  // Only attempt to unlink if this document is file-backed.
  if (doc.file_path) {
    try {
      const absolutePath = path.join(config.uploadDir, doc.file_path)
      await unlink(absolutePath)
    } catch {
      // File may already be missing — continue
    }
  }

  await doc.destroy()

  await logAudit(userId, 'delete', 'oc_document', docId, {
    title: doc.title,
    type: doc.type,
  })
}
