import { Op, type WhereOptions } from 'sequelize'
import {
  IncidentReport,
  IncidentAttachment,
  IncidentComment,
  User,
  Notification,
  UserNotification,
} from '../models/index.js'
import { parsePagination, paginatedResponse } from '../utils/pagination.js'
import { logAudit } from '../utils/audit.js'
import { saveFile, type SaveFileResult, type FileInput } from '../plugins/upload.js'
import { sanitizeText } from '../utils/sanitize.js'

// ── Types ──

export interface CreateReportInput {
  title: string
  type: 'repair' | 'complaint' | 'inquiry'
  description: string
  locationBlock?: string | null
  locationFloor?: string | null
  locationArea?: string | null
}

export interface ListReportsFilters {
  status?: string
  type?: string
  page?: string | number
  limit?: string | number
  startDate?: string
  endDate?: string
}

// ── Service Functions ──

/**
 * Create a new incident report.
 */
export async function create(userId: string, data: CreateReportInput) {
  const report = await IncidentReport.create({
    reporter_id: userId,
    title: sanitizeText(data.title),
    type: data.type,
    description: sanitizeText(data.description),
    location_block: data.locationBlock ?? null,
    location_floor: data.locationFloor ?? null,
    location_area: data.locationArea ?? null,
  })

  return report
}

/**
 * List reports with pagination and filters.
 * Residents see only their own reports; mgmt/admin see all.
 */
export async function list(
  userId: string,
  role: string,
  filters: ListReportsFilters
) {
  const { offset, limit } = parsePagination({
    page: filters.page,
    limit: filters.limit,
  })

  const where: WhereOptions = {}

  // Residents and OC committee only see their own reports
  if (role === 'resident' || role === 'oc_committee') {
    ;(where as any).reporter_id = userId
  }

  if (filters.status) {
    ;(where as any).status = filters.status
  }

  if (filters.type) {
    ;(where as any).type = filters.type
  }

  if (filters.startDate || filters.endDate) {
    const dateFilter: any = {}
    if (filters.startDate) {
      dateFilter[Op.gte] = new Date(filters.startDate)
    }
    if (filters.endDate) {
      dateFilter[Op.lte] = new Date(filters.endDate)
    }
    ;(where as any).created_at = dateFilter
  }

  const { rows, count } = await IncidentReport.findAndCountAll({
    where,
    include: [
      {
        model: User,
        as: 'reporter',
        attributes: ['id', 'name', 'email'],
      },
    ],
    order: [['created_at', 'DESC']],
    offset,
    limit,
  })

  const page = Math.floor(offset / limit) + 1
  return paginatedResponse(rows, count, page, limit)
}

/**
 * Get report by ID with attachments and comments.
 * Residents can only view their own reports.
 * Internal comments are hidden from non-mgmt users.
 */
export async function getById(
  reportId: string,
  userId: string,
  role: string
) {
  const isMgmt = role === 'mgmt_staff' || role === 'admin'

  const commentWhere: WhereOptions = {}
  if (!isMgmt) {
    ;(commentWhere as any).is_internal = false
  }

  const report = await IncidentReport.findByPk(reportId, {
    include: [
      {
        model: User,
        as: 'reporter',
        attributes: ['id', 'name', 'email'],
      },
      {
        model: IncidentAttachment,
        as: 'attachments',
      },
      {
        model: IncidentComment,
        as: 'comments',
        where: Object.keys(commentWhere).length > 0 ? commentWhere : undefined,
        required: false,
        include: [
          {
            model: User,
            as: 'author',
            attributes: ['id', 'name', 'role'],
          },
        ],
      },
    ],
    order: [[{ model: IncidentComment, as: 'comments' }, 'created_at', 'ASC']],
  })

  if (!report) {
    return null
  }

  // Residents can only view their own reports
  if (!isMgmt && report.reporter_id !== userId) {
    return { forbidden: true }
  }

  return report
}

/**
 * Update report status (mgmt/admin only).
 * Writes an audit log entry.
 */
export async function updateStatus(
  reportId: string,
  newStatus: 'pending' | 'in_progress' | 'completed',
  userId: string
) {
  const report = await IncidentReport.findByPk(reportId)

  if (!report) {
    return null
  }

  const oldStatus = report.status
  report.status = newStatus
  await report.save()

  // Fire-and-forget audit log
  await logAudit(userId, 'update_status', 'incident_report', reportId, {
    oldStatus,
    newStatus,
  })

  // Auto-trigger notification for the reporter
  try {
    const notification = await Notification.create({
      sender_id: userId,
      title: '事件報告狀態更新',
      body: `你的報告「${report.title}」已更新為${newStatus}`,
      category: 'general',
      target_type: 'all',
    })

    await UserNotification.create({
      notification_id: notification.id,
      user_id: report.reporter_id,
    })
  } catch {
    // Fire-and-forget: do not fail the status update if notification fails
  }

  return report
}

/**
 * Add a comment to a report.
 * isInternal is only respected for mgmt/admin; forced to false for others.
 */
export async function addComment(
  reportId: string,
  userId: string,
  role: string,
  content: string,
  isInternal: boolean
) {
  // Verify report exists
  const report = await IncidentReport.findByPk(reportId)
  if (!report) {
    return null
  }

  // Non-mgmt users cannot create internal comments
  const isMgmt = role === 'mgmt_staff' || role === 'admin'
  const internalFlag = isMgmt ? isInternal : false

  const comment = await IncidentComment.create({
    report_id: reportId,
    author_id: userId,
    content: sanitizeText(content),
    is_internal: internalFlag,
  })

  return comment
}

/**
 * Add file attachments to a report.
 * Saves files via the upload plugin and creates IncidentAttachment records.
 */
export async function addAttachments(
  reportId: string,
  files: FileInput[]
): Promise<IncidentAttachment[] | null> {
  // Verify report exists
  const report = await IncidentReport.findByPk(reportId)
  if (!report) {
    return null
  }

  const savedFiles: SaveFileResult[] = []
  for (const file of files) {
    const result = await saveFile(file, 'reports')
    savedFiles.push(result)
  }

  const attachments = await Promise.all(
    savedFiles.map((f) =>
      IncidentAttachment.create({
        report_id: reportId,
        file_path: f.filePath,
        file_type: f.fileType,
        file_size: f.fileSize,
      })
    )
  )

  return attachments
}
