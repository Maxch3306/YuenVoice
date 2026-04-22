import { Op, fn, col, literal } from 'sequelize'
import {
  DiscussionBoard,
  DiscussionPost,
  PostImage,
  PostComment,
  PostReaction,
  User,
  Flat,
} from '../models/index.js'
import { saveFile, type FileInput } from '../plugins/upload.js'
import { logAudit } from '../utils/audit.js'
import type { PaginationParams } from '../utils/pagination.js'
import { sanitizeText } from '../utils/sanitize.js'
import { getOwnedFlatIds } from './user-flat.service.js'

// ── Helpers ──

function maskAuthor(user: { name: string; id: string } | null, isAnonymous: boolean) {
  if (isAnonymous || !user) {
    return { id: null, name: '匿名業戶' }
  }
  return { id: user.id, name: user.name }
}

// ── Service Functions ──

/**
 * List boards accessible by the user.
 * Admins and management staff see all boards.
 * Residents and OC committee see estate-wide + every (block/floor) pair from
 * any flat they own (primary + any flats linked via user_flats).
 */
export async function listBoards(userId: string, userRole: string) {
  const seeAll = userRole === 'admin' || userRole === 'mgmt_staff'

  let whereClause: any = {}

  if (!seeAll) {
    const conditions: any[] = [{ scope_type: 'estate' }]

    const flatIds = await getOwnedFlatIds(userId)
    if (flatIds.length > 0) {
      const flats = await Flat.findAll({
        where: { id: flatIds },
        attributes: ['block', 'floor'],
      })

      // De-dupe block/floor combos — two units on the same floor/block shouldn't
      // produce duplicate OR clauses.
      const seenBlocks = new Set<string>()
      const seenFloors = new Set<string>()
      for (const flat of flats) {
        if (!seenBlocks.has(flat.block)) {
          seenBlocks.add(flat.block)
          conditions.push({
            scope_type: 'block',
            scope_block: flat.block,
          })
        }
        const floorKey = `${flat.block}|${flat.floor}`
        if (!seenFloors.has(floorKey)) {
          seenFloors.add(floorKey)
          conditions.push({
            scope_type: 'floor',
            scope_block: flat.block,
            scope_floor: flat.floor,
          })
        }
      }
    }

    whereClause = { [Op.or]: conditions }
  }

  const boards = await DiscussionBoard.findAll({
    where: whereClause,
    order: [['created_at', 'ASC']],
    attributes: {
      include: [
        [
          literal(`(SELECT COUNT(*) FROM discussion_posts WHERE discussion_posts.board_id = "DiscussionBoard"."id" AND discussion_posts.is_hidden = false)`),
          'postCount',
        ],
        [
          literal(`(SELECT MAX(created_at) FROM discussion_posts WHERE discussion_posts.board_id = "DiscussionBoard"."id")`),
          'latestPostDate',
        ],
      ],
    },
  })

  return boards
}

/**
 * List posts in a board with pagination. Pinned posts first, then reverse-chron.
 * Hidden posts excluded for non-mgmt users.
 */
export async function listPosts(
  boardId: string,
  pagination: PaginationParams,
  userRole: string,
) {
  const whereClause: any = { board_id: boardId }

  // Non-management users cannot see hidden posts
  if (!['mgmt_staff', 'admin'].includes(userRole)) {
    whereClause.is_hidden = false
  }

  const { count, rows } = await DiscussionPost.findAndCountAll({
    where: whereClause,
    order: [
      ['is_pinned', 'DESC'],
      ['created_at', 'DESC'],
    ],
    offset: pagination.offset,
    limit: pagination.limit,
    include: [
      {
        model: User,
        as: 'author',
        attributes: ['id', 'name'],
      },
    ],
    attributes: {
      exclude: ['body'],
      include: [
        [
          literal(`LEFT(body, 100)`),
          'bodyExcerpt',
        ],
        [
          literal(`(SELECT COUNT(*) FROM post_images WHERE post_images.post_id = "DiscussionPost"."id")`),
          'imageCount',
        ],
        [
          literal(`(SELECT COUNT(*) FROM post_comments WHERE post_comments.post_id = "DiscussionPost"."id")`),
          'commentCount',
        ],
        [
          literal(`(SELECT COUNT(*) FROM post_reactions WHERE post_reactions.post_id = "DiscussionPost"."id")`),
          'reactionCount',
        ],
      ],
    },
  })

  // Mask anonymous authors
  const data = rows.map((post) => {
    const plain = post.toJSON() as any
    plain.author = maskAuthor(plain.author, plain.is_anonymous)
    return plain
  })

  return { count, rows: data }
}

/**
 * Create a post with optional photo uploads (max 5).
 */
export async function createPost(
  boardId: string,
  userId: string,
  data: { title: string; body: string; isAnonymous?: boolean },
  files?: FileInput[],
) {
  const post = await DiscussionPost.create({
    board_id: boardId,
    author_id: userId,
    title: sanitizeText(data.title),
    body: sanitizeText(data.body),
    is_anonymous: data.isAnonymous ?? false,
  })

  const images: any[] = []

  if (files) {
    for (const file of files.slice(0, 5)) {
      const saved = await saveFile(file, 'posts')
      const image = await PostImage.create({
        post_id: post.id,
        file_path: saved.filePath,
        file_size: saved.fileSize,
      })
      images.push(image.toJSON())
    }
  }

  const result = post.toJSON() as any
  result.images = images
  result.author = data.isAnonymous
    ? { id: null, name: '匿名業戶' }
    : (await User.findByPk(userId, { attributes: ['id', 'name'] }))?.toJSON() ?? null

  return result
}

/**
 * Get post detail with images, comments, and reactions.
 */
export async function getPost(postId: string, userRole: string) {
  const post = await DiscussionPost.findByPk(postId, {
    include: [
      {
        model: User,
        as: 'author',
        attributes: ['id', 'name'],
      },
      {
        model: PostImage,
        as: 'images',
        attributes: ['id', 'file_path', 'file_size', 'created_at'],
      },
      {
        model: PostComment,
        as: 'comments',
        include: [
          {
            model: User,
            as: 'author',
            attributes: ['id', 'name'],
          },
        ],
        attributes: ['id', 'content', 'is_anonymous', 'author_id', 'created_at'],
      },
      {
        model: PostReaction,
        as: 'reactions',
        attributes: ['id', 'user_id', 'type', 'created_at'],
      },
    ],
  })

  if (!post) return null

  // Hidden posts not visible to regular users
  if (post.is_hidden && !['mgmt_staff', 'admin'].includes(userRole)) {
    return null
  }

  const plain = post.toJSON() as any

  // Mask anonymous post author
  plain.author = maskAuthor(plain.author, plain.is_anonymous)

  // Mask anonymous comment authors
  if (plain.comments) {
    plain.comments = plain.comments.map((c: any) => {
      c.author = maskAuthor(c.author, c.is_anonymous)
      return c
    })
  }

  // Add reaction summary
  plain.reactionCount = plain.reactions?.length ?? 0

  return plain
}

/**
 * Add a comment to a post.
 */
export async function addComment(
  postId: string,
  userId: string,
  content: string,
  isAnonymous: boolean,
) {
  // Verify post exists
  const post = await DiscussionPost.findByPk(postId, { attributes: ['id'] })
  if (!post) return null

  const comment = await PostComment.create({
    post_id: postId,
    author_id: userId,
    content: sanitizeText(content),
    is_anonymous: isAnonymous,
  })

  const plain = comment.toJSON() as any

  if (isAnonymous) {
    plain.author = { id: null, name: '匿名業戶' }
  } else {
    const user = await User.findByPk(userId, { attributes: ['id', 'name'] })
    plain.author = user ? { id: user.id, name: user.name } : null
  }

  return plain
}

/**
 * Toggle reaction: add if not exists, remove if exists.
 */
export async function toggleReaction(
  postId: string,
  userId: string,
  type: 'like',
) {
  // Verify post exists
  const post = await DiscussionPost.findByPk(postId, { attributes: ['id'] })
  if (!post) return null

  const existing = await PostReaction.findOne({
    where: { post_id: postId, user_id: userId, type },
  })

  let reacted: boolean

  if (existing) {
    await existing.destroy()
    reacted = false
  } else {
    await PostReaction.create({ post_id: postId, user_id: userId, type })
    reacted = true
  }

  const totalReactions = await PostReaction.count({ where: { post_id: postId } })

  return { reacted, totalReactions }
}

/**
 * Flag a post (increment flag count via a simple update).
 * For now we track flags as a report action in the audit log.
 */
export async function flagPost(postId: string, userId: string, reason?: string) {
  const post = await DiscussionPost.findByPk(postId, { attributes: ['id'] })
  if (!post) return null

  // Log the flag as an audit entry so management can review
  await logAudit(userId, 'flag', 'discussion_post', postId, { reason: reason ?? null })

  return { message: 'Post flagged' }
}

/**
 * Moderate a post: hide, pin, unpin, or delete. Writes audit log.
 */
export async function moderatePost(
  postId: string,
  action: 'hide' | 'pin' | 'unpin' | 'delete',
  userId: string,
) {
  const post = await DiscussionPost.findByPk(postId)
  if (!post) return null

  switch (action) {
    case 'hide':
      post.is_hidden = true
      await post.save()
      break
    case 'pin':
      post.is_pinned = true
      await post.save()
      break
    case 'unpin':
      post.is_pinned = false
      await post.save()
      break
    case 'delete':
      await post.destroy()
      break
  }

  await logAudit(userId, `discussion_post.${action}`, 'discussion_post', postId)

  if (action === 'delete') {
    return { id: postId, deleted: true }
  }

  return post.toJSON()
}
