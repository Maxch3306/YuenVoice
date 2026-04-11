import { Op } from 'sequelize'
import { OcDocument, User, Notification, UserNotification } from '../models/index.js'
import { saveFile, type FileInput } from '../plugins/upload.js'
import { parsePagination, paginatedResponse, type PaginatedResponse } from '../utils/pagination.js'
import { logAudit } from '../utils/audit.js'
import { unlink } from 'node:fs/promises'
import path from 'node:path'
import { config } from '../config/index.js'
import { sanitizeText } from '../utils/sanitize.js'

export interface UploadDocumentData {
  title: string
  description?: string
  type: 'meeting_minutes' | 'financial_statement' | 'resolution' | 'notice'
  year: number
}

export interface ListDocumentFilters {
  year?: number
  type?: string
  page?: string | number
  limit?: string | number
}

export async function uploadDocument(
  publisherId: string,
  data: UploadDocumentData,
  file: FileInput
): Promise<OcDocument> {
  const { filePath } = await saveFile(file, 'oc-documents')

  const doc = await OcDocument.create({
    publisher_id: publisherId,
    title: sanitizeText(data.title),
    description: data.description ? sanitizeText(data.description) : null,
    type: data.type,
    year: data.year,
    file_path: filePath,
  })

  // Auto-trigger notification for all residents
  try {
    const notification = await Notification.create({
      sender_id: publisherId,
      title: '新法團文件',
      body: `已發佈新文件：${data.title}`,
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
        }))
      )
    }
  } catch {
    // Fire-and-forget: do not fail the upload if notification fails
  }

  return doc
}

export async function listDocuments(
  filters: ListDocumentFilters
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

  // Delete file from storage
  try {
    const absolutePath = path.join(config.uploadDir, doc.file_path)
    await unlink(absolutePath)
  } catch {
    // File may already be missing — continue
  }

  await doc.destroy()

  await logAudit(userId, 'delete', 'oc_document', docId, {
    title: doc.title,
    type: doc.type,
  })
}
