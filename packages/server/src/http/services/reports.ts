import { and, asc, desc, eq, gte, inArray, lte, sql } from 'drizzle-orm'
import type { Db } from '../../db/client.js'
import type { Env } from '../../env.js'
import {
  incidentReports,
  incidentAttachments,
  incidentComments,
  notifications,
  userNotifications,
  users,
  auditLogs,
} from '../../db/schema.js'
import { parsePagination, paginatedResponse } from '../../utils/pagination.js'
import { logAudit } from '../audit.js'
import { saveFile } from '../upload.js'
import { sanitizeText } from '../sanitize.js'
import * as pushService from './push.js'

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

const reporterCols = { id: users.id, name: users.name, email: users.email }

export async function create(db: Db, userId: string, data: CreateReportInput) {
  const [report] = await db
    .insert(incidentReports)
    .values({
      reporter_id: userId,
      title: sanitizeText(data.title),
      type: data.type,
      description: sanitizeText(data.description),
      location_block: data.locationBlock ?? null,
      location_floor: data.locationFloor ?? null,
      location_area: data.locationArea ?? null,
    })
    .returning()
  return report
}

export async function list(db: Db, userId: string, role: string, filters: ListReportsFilters) {
  const { offset, limit } = parsePagination({ page: filters.page, limit: filters.limit })

  const conditions = []
  if (role === 'resident') conditions.push(eq(incidentReports.reporter_id, userId))
  if (filters.status) conditions.push(eq(incidentReports.status, filters.status as 'pending'))
  if (filters.type) conditions.push(eq(incidentReports.type, filters.type as 'repair'))
  if (filters.startDate) conditions.push(gte(incidentReports.created_at, filters.startDate))
  if (filters.endDate) conditions.push(lte(incidentReports.created_at, filters.endDate))
  const where = conditions.length ? and(...conditions) : undefined

  const rows = await db.query.incidentReports.findMany({
    where,
    with: { reporter: { columns: { id: true, name: true, email: true } } },
    orderBy: desc(incidentReports.created_at),
    limit,
    offset,
  })
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(incidentReports)
    .where(where)

  const page = Math.floor(offset / limit) + 1
  return paginatedResponse(rows, Number(count), page, limit)
}

export async function getById(db: Db, reportId: string, userId: string, role: string) {
  const isMgmt = role === 'mgmt_staff' || role === 'admin'
  const canReviewAll = isMgmt || role === 'oc_committee'

  const report = await db.query.incidentReports.findFirst({
    where: eq(incidentReports.id, reportId),
    with: {
      reporter: { columns: { id: true, name: true, email: true } },
      attachments: true,
      comments: {
        // Internal comments are hidden from non-mgmt users.
        where: isMgmt ? undefined : eq(incidentComments.is_internal, false),
        orderBy: asc(incidentComments.created_at),
        with: { author: { columns: { id: true, name: true, role: true } } },
      },
    },
  })

  if (!report) return null
  if (!canReviewAll && report.reporter_id !== userId) return { forbidden: true as const }
  return report
}

export async function updateStatus(
  db: Db,
  reportId: string,
  newStatus: 'pending' | 'in_progress' | 'completed',
  userId: string,
) {
  const [report] = await db
    .select()
    .from(incidentReports)
    .where(eq(incidentReports.id, reportId))
    .limit(1)
  if (!report) return null

  const oldStatus = report.status
  await db.update(incidentReports).set({ status: newStatus }).where(eq(incidentReports.id, reportId))

  await logAudit(db, userId, 'update_status', 'incident_report', reportId, { oldStatus, newStatus })

  // Notify the reporter (fire-and-forget).
  try {
    const [notification] = await db
      .insert(notifications)
      .values({
        sender_id: userId,
        title: '事件報告狀態更新',
        body: `你的報告「${report.title}」已更新為${newStatus}`,
        category: 'general',
        target_type: 'all',
      })
      .returning({ id: notifications.id })
    await db
      .insert(userNotifications)
      .values({ notification_id: notification.id, user_id: report.reporter_id })
  } catch {
    // ignore
  }

  return { ...report, status: newStatus }
}

export async function addComment(
  db: Db,
  env: Env,
  reportId: string,
  userId: string,
  role: string,
  content: string,
  isInternal: boolean,
) {
  const [report] = await db
    .select()
    .from(incidentReports)
    .where(eq(incidentReports.id, reportId))
    .limit(1)
  if (!report) return null

  const isMgmt = role === 'mgmt_staff' || role === 'admin'
  const internalFlag = isMgmt ? isInternal : false

  const [comment] = await db
    .insert(incidentComments)
    .values({
      report_id: reportId,
      author_id: userId,
      content: sanitizeText(content),
      is_internal: internalFlag,
    })
    .returning()

  // Auto-reopen a completed report when a non-mgmt user follows up.
  if (!isMgmt && report.status === 'completed') {
    await db
      .update(incidentReports)
      .set({ status: 'in_progress' })
      .where(eq(incidentReports.id, reportId))

    await logAudit(db, userId, 'auto_reopen', 'incident_report', reportId, {
      reason: 'resident_comment_on_completed',
    })

    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(auditLogs)
      .where(
        and(
          eq(auditLogs.action, 'auto_reopen'),
          eq(auditLogs.entity_type, 'incident_report'),
          eq(auditLogs.entity_id, reportId),
        ),
      )
    const reopenCount = Number(count)

    await notifyMgmtOfReopen(db, env, report, userId)
    if (reopenCount >= 3) {
      await notifyCommitteeOfRepeatedReopen(db, env, report, userId, reopenCount)
    }
  }

  return comment
}

export async function addAttachments(
  db: Db,
  env: Env,
  reportId: string,
  files: (ArrayBuffer | Uint8Array)[],
) {
  const [report] = await db
    .select()
    .from(incidentReports)
    .where(eq(incidentReports.id, reportId))
    .limit(1)
  if (!report) return null

  const saved = []
  for (const data of files) saved.push(await saveFile(env, data, 'reports'))

  const attachments = await db
    .insert(incidentAttachments)
    .values(
      saved.map((f) => ({
        report_id: reportId,
        file_path: f.filePath,
        file_type: f.fileType,
        file_size: f.fileSize,
      })),
    )
    .returning()

  return attachments
}

async function notifyMgmtOfReopen(db: Db, env: Env, report: typeof incidentReports.$inferSelect, byUser: string) {
  try {
    const mgmt = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.is_active, true), inArray(users.role, ['mgmt_staff', 'admin'])))
    if (mgmt.length === 0) return

    const [n] = await db
      .insert(notifications)
      .values({
        sender_id: byUser,
        title: '事件報告重新開啟',
        body: `業主已留言，「${report.title}」重新開啟跟進`,
        category: 'general',
        target_type: 'all',
      })
      .returning({ id: notifications.id, title: notifications.title, body: notifications.body, category: notifications.category })

    await db.insert(userNotifications).values(mgmt.map((u) => ({ notification_id: n.id, user_id: u.id })))
    pushService.sendToUsers(env, mgmt.map((u) => u.id), { title: n.title, body: n.body, category: n.category }).catch(() => {})
  } catch {
    // fire-and-forget
  }
}

async function notifyCommitteeOfRepeatedReopen(
  db: Db,
  env: Env,
  report: typeof incidentReports.$inferSelect,
  byUser: string,
  reopenCount: number,
) {
  try {
    const committee = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.is_active, true), eq(users.role, 'oc_committee')))
    if (committee.length === 0) return

    const [n] = await db
      .insert(notifications)
      .values({
        sender_id: byUser,
        title: '事件報告多次重新開啟',
        body: `「${report.title}」已被重新開啟 ${reopenCount} 次，請委員留意此跟進情況`,
        category: 'urgent',
        target_type: 'all',
      })
      .returning({ id: notifications.id, title: notifications.title, body: notifications.body, category: notifications.category })

    await db.insert(userNotifications).values(committee.map((u) => ({ notification_id: n.id, user_id: u.id })))
    pushService.sendToUsers(env, committee.map((u) => u.id), { title: n.title, body: n.body, category: n.category }).catch(() => {})
  } catch {
    // fire-and-forget
  }
}
