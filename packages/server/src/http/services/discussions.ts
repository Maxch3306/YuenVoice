import { and, asc, desc, eq, inArray, or, sql } from 'drizzle-orm'
import type { Db } from '../../db/client.js'
import type { Env } from '../../env.js'
import {
  discussionBoards,
  discussionPosts,
  postImages,
  postComments,
  postReactions,
  users,
  flats,
  userFlats,
} from '../../db/schema.js'
import type { PaginationParams } from '../../utils/pagination.js'
import { logAudit } from '../audit.js'
import { saveFile } from '../upload.js'
import { sanitizeText, sanitizeHtml } from '../sanitize.js'

// ── Helpers ──

function maskAuthor(user: { name: string; id: string } | null, isAnonymous: boolean) {
  if (isAnonymous || !user) {
    return { id: null, name: '匿名業戶' }
  }
  return { id: user.id, name: user.name }
}

/**
 * Resolve every flat id this user owns (primary + linked), primary-first then
 * most-recently-linked first. Ported from user-flat.service.getOwnedFlatIds.
 */
async function getOwnedFlatIds(db: Db, userId: string): Promise<string[]> {
  const [user] = await db
    .select({ flat_id: users.flat_id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  const links = await db
    .select({ flat_id: userFlats.flat_id })
    .from(userFlats)
    .where(eq(userFlats.user_id, userId))
    .orderBy(desc(userFlats.linked_at))

  const ids: string[] = []
  if (user?.flat_id) ids.push(user.flat_id)
  for (const l of links) {
    if (!ids.includes(l.flat_id)) ids.push(l.flat_id)
  }
  return ids
}

// ── Service Functions ──

/**
 * List boards accessible by the user.
 * Admins and management staff see all boards.
 * Residents and OC committee see estate-wide + every (block/floor) pair from
 * any flat they own (primary + any flats linked via user_flats).
 */
export async function listBoards(db: Db, userId: string, userRole: string) {
  const seeAll = userRole === 'admin' || userRole === 'mgmt_staff'

  let where: ReturnType<typeof or> | undefined

  if (!seeAll) {
    const conditions = [eq(discussionBoards.scope_type, 'estate')]

    const flatIds = await getOwnedFlatIds(db, userId)
    if (flatIds.length > 0) {
      const ownedFlats = await db
        .select({ block: flats.block, floor: flats.floor })
        .from(flats)
        .where(inArray(flats.id, flatIds))

      // De-dupe block/floor combos — two units on the same floor/block shouldn't
      // produce duplicate OR clauses.
      const seenBlocks = new Set<string>()
      const seenFloors = new Set<string>()
      for (const flat of ownedFlats) {
        if (!seenBlocks.has(flat.block)) {
          seenBlocks.add(flat.block)
          conditions.push(
            and(
              eq(discussionBoards.scope_type, 'block'),
              eq(discussionBoards.scope_block, flat.block),
            )!,
          )
        }
        const floorKey = `${flat.block}|${flat.floor}`
        if (!seenFloors.has(floorKey)) {
          seenFloors.add(floorKey)
          conditions.push(
            and(
              eq(discussionBoards.scope_type, 'floor'),
              eq(discussionBoards.scope_block, flat.block),
              eq(discussionBoards.scope_floor, flat.floor),
            )!,
          )
        }
      }
    }

    where = or(...conditions)
  }

  const boards = await db
    .select()
    .from(discussionBoards)
    .where(where)
    .orderBy(asc(discussionBoards.created_at))

  // Per-board post aggregates: postCount excludes hidden posts, latestPostDate
  // considers every post.
  const boardIds = boards.map((b) => b.id)
  const stats = boardIds.length
    ? await db
        .select({
          board_id: discussionPosts.board_id,
          postCount: sql<number>`sum(case when ${discussionPosts.is_hidden} = 0 then 1 else 0 end)`,
          latestPostDate: sql<string | null>`max(${discussionPosts.created_at})`,
        })
        .from(discussionPosts)
        .where(inArray(discussionPosts.board_id, boardIds))
        .groupBy(discussionPosts.board_id)
    : []

  const statByBoard = new Map(stats.map((s) => [s.board_id, s]))

  return boards.map((board) => {
    const stat = statByBoard.get(board.id)
    return {
      ...board,
      postCount: Number(stat?.postCount ?? 0),
      latestPostDate: stat?.latestPostDate ?? null,
    }
  })
}

/**
 * List posts in a board with pagination. Pinned posts first, then reverse-chron.
 * Hidden posts excluded for non-mgmt users.
 */
export async function listPosts(
  db: Db,
  boardId: string,
  pagination: PaginationParams,
  userRole: string,
) {
  const conditions = [eq(discussionPosts.board_id, boardId)]

  // Non-management users cannot see hidden posts
  if (!['mgmt_staff', 'admin'].includes(userRole)) {
    conditions.push(eq(discussionPosts.is_hidden, false))
  }
  const where = and(...conditions)

  const rows = await db.query.discussionPosts.findMany({
    where,
    orderBy: [desc(discussionPosts.is_pinned), desc(discussionPosts.created_at)],
    offset: pagination.offset,
    limit: pagination.limit,
    columns: { body: false },
    extras: {
      bodyExcerpt: sql<string>`substr(${discussionPosts.body}, 1, 100)`.as('bodyExcerpt'),
    },
    with: {
      author: { columns: { id: true, name: true } },
    },
  })

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(discussionPosts)
    .where(where)

  const postIds = rows.map((r) => r.id)
  const [imageCounts, commentCounts, reactionCounts] = postIds.length
    ? await Promise.all([
        db
          .select({ post_id: postImages.post_id, count: sql<number>`count(*)` })
          .from(postImages)
          .where(inArray(postImages.post_id, postIds))
          .groupBy(postImages.post_id),
        db
          .select({ post_id: postComments.post_id, count: sql<number>`count(*)` })
          .from(postComments)
          .where(inArray(postComments.post_id, postIds))
          .groupBy(postComments.post_id),
        db
          .select({ post_id: postReactions.post_id, count: sql<number>`count(*)` })
          .from(postReactions)
          .where(inArray(postReactions.post_id, postIds))
          .groupBy(postReactions.post_id),
      ])
    : [[], [], []]

  const imageBy = new Map(imageCounts.map((r) => [r.post_id, Number(r.count)]))
  const commentBy = new Map(commentCounts.map((r) => [r.post_id, Number(r.count)]))
  const reactionBy = new Map(reactionCounts.map((r) => [r.post_id, Number(r.count)]))

  // Mask anonymous authors
  const data = rows.map((post) => {
    const { author, ...rest } = post as typeof post & { author: { id: string; name: string } | null }
    return {
      ...rest,
      author: maskAuthor(author, post.is_anonymous),
      imageCount: imageBy.get(post.id) ?? 0,
      commentCount: commentBy.get(post.id) ?? 0,
      reactionCount: reactionBy.get(post.id) ?? 0,
    }
  })

  return { count: Number(count), rows: data }
}

/**
 * Create a post with optional photo uploads (max 5).
 */
export async function createPost(
  db: Db,
  env: Env,
  boardId: string,
  userId: string,
  data: { title: string; body: string; isAnonymous?: boolean },
  files?: (ArrayBuffer | Uint8Array)[],
) {
  const [post] = await db
    .insert(discussionPosts)
    .values({
      board_id: boardId,
      author_id: userId,
      title: sanitizeText(data.title),
      body: sanitizeHtml(data.body),
      is_anonymous: data.isAnonymous ?? false,
    })
    .returning()

  const images: (typeof postImages.$inferSelect)[] = []

  if (files) {
    for (const file of files.slice(0, 5)) {
      const saved = await saveFile(env, file, 'discussions')
      const [image] = await db
        .insert(postImages)
        .values({
          post_id: post.id,
          file_path: saved.filePath,
          file_size: saved.fileSize,
        })
        .returning()
      images.push(image)
    }
  }

  let author: { id: string | null; name: string } | null
  if (data.isAnonymous) {
    author = { id: null, name: '匿名業戶' }
  } else {
    const [u] = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
    author = u ?? null
  }

  return { ...post, images, author }
}

/**
 * Get post detail with images, comments, and reactions.
 */
export async function getPost(db: Db, postId: string, userRole: string) {
  const post = await db.query.discussionPosts.findFirst({
    where: eq(discussionPosts.id, postId),
    with: {
      author: { columns: { id: true, name: true } },
      images: {
        columns: { id: true, file_path: true, file_size: true, created_at: true },
      },
      comments: {
        orderBy: asc(postComments.created_at),
        columns: {
          id: true,
          content: true,
          is_anonymous: true,
          author_id: true,
          created_at: true,
        },
        with: { author: { columns: { id: true, name: true } } },
      },
      reactions: {
        columns: { id: true, user_id: true, type: true, created_at: true },
      },
    },
  })

  if (!post) return null

  // Hidden posts not visible to regular users
  if (post.is_hidden && !['mgmt_staff', 'admin'].includes(userRole)) {
    return null
  }

  const comments = post.comments.map((c) => ({
    ...c,
    author: maskAuthor(c.author, c.is_anonymous),
  }))

  return {
    ...post,
    author: maskAuthor(post.author, post.is_anonymous),
    comments,
    reactionCount: post.reactions?.length ?? 0,
  }
}

/**
 * Add a comment to a post.
 */
export async function addComment(
  db: Db,
  postId: string,
  userId: string,
  content: string,
  isAnonymous: boolean,
) {
  // Verify post exists
  const [post] = await db
    .select({ id: discussionPosts.id })
    .from(discussionPosts)
    .where(eq(discussionPosts.id, postId))
    .limit(1)
  if (!post) return null

  const [comment] = await db
    .insert(postComments)
    .values({
      post_id: postId,
      author_id: userId,
      content: sanitizeText(content),
      is_anonymous: isAnonymous,
    })
    .returning()

  let author: { id: string | null; name: string } | null
  if (isAnonymous) {
    author = { id: null, name: '匿名業戶' }
  } else {
    const [u] = await db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1)
    author = u ?? null
  }

  return { ...comment, author }
}

/**
 * Toggle reaction: add if not exists, remove if exists.
 */
export async function toggleReaction(db: Db, postId: string, userId: string, type: 'like') {
  // Verify post exists
  const [post] = await db
    .select({ id: discussionPosts.id })
    .from(discussionPosts)
    .where(eq(discussionPosts.id, postId))
    .limit(1)
  if (!post) return null

  const [existing] = await db
    .select({ id: postReactions.id })
    .from(postReactions)
    .where(
      and(
        eq(postReactions.post_id, postId),
        eq(postReactions.user_id, userId),
        eq(postReactions.type, type),
      ),
    )
    .limit(1)

  let reacted: boolean

  if (existing) {
    await db.delete(postReactions).where(eq(postReactions.id, existing.id))
    reacted = false
  } else {
    await db.insert(postReactions).values({ post_id: postId, user_id: userId, type })
    reacted = true
  }

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(postReactions)
    .where(eq(postReactions.post_id, postId))

  return { reacted, totalReactions: Number(count) }
}

/**
 * Flag a post. Tracked as an audit entry so management can review.
 */
export async function flagPost(db: Db, postId: string, userId: string, reason?: string) {
  const [post] = await db
    .select({ id: discussionPosts.id })
    .from(discussionPosts)
    .where(eq(discussionPosts.id, postId))
    .limit(1)
  if (!post) return null

  await logAudit(db, userId, 'flag', 'discussion_post', postId, { reason: reason ?? null })

  return { message: 'Post flagged' }
}

/**
 * Moderate a post: hide, pin, unpin, or delete. Writes audit log.
 */
export async function moderatePost(
  db: Db,
  postId: string,
  action: 'hide' | 'pin' | 'unpin' | 'delete',
  userId: string,
) {
  const [post] = await db
    .select()
    .from(discussionPosts)
    .where(eq(discussionPosts.id, postId))
    .limit(1)
  if (!post) return null

  let updated = post
  switch (action) {
    case 'hide': {
      const [row] = await db
        .update(discussionPosts)
        .set({ is_hidden: true })
        .where(eq(discussionPosts.id, postId))
        .returning()
      updated = row
      break
    }
    case 'pin': {
      const [row] = await db
        .update(discussionPosts)
        .set({ is_pinned: true })
        .where(eq(discussionPosts.id, postId))
        .returning()
      updated = row
      break
    }
    case 'unpin': {
      const [row] = await db
        .update(discussionPosts)
        .set({ is_pinned: false })
        .where(eq(discussionPosts.id, postId))
        .returning()
      updated = row
      break
    }
    case 'delete':
      await db.delete(discussionPosts).where(eq(discussionPosts.id, postId))
      break
  }

  await logAudit(db, userId, `discussion_post.${action}`, 'discussion_post', postId)

  if (action === 'delete') {
    return { id: postId, deleted: true }
  }

  return updated
}
