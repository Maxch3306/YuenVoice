// Re-export sequelize instance (defined in sequelize.ts to avoid circular imports)
export { sequelize } from './sequelize.js'

// Import all models
import { Flat } from './flat.js'
import { User } from './user.js'
import { IncidentReport } from './incident-report.js'
import { IncidentAttachment } from './incident-attachment.js'
import { IncidentComment } from './incident-comment.js'
import { DiscussionBoard } from './discussion-board.js'
import { DiscussionPost } from './discussion-post.js'
import { PostImage } from './post-image.js'
import { PostComment } from './post-comment.js'
import { PostReaction } from './post-reaction.js'
import { OcDocument } from './oc-document.js'
import { Notification } from './notification.js'
import { UserNotification } from './user-notification.js'
import { AuditLog } from './audit-log.js'
import { UserFlat } from './user-flat.js'

// ── Associations ──

// Flat ↔ User (primary flat set at registration)
Flat.hasMany(User, { foreignKey: 'flat_id', as: 'residents' })
User.belongsTo(Flat, { foreignKey: 'flat_id', as: 'flat' })

// User ↔ Flat (additional linked flats — for owners with multiple units)
User.belongsToMany(Flat, {
  through: UserFlat,
  foreignKey: 'user_id',
  otherKey: 'flat_id',
  as: 'linkedFlats',
})
Flat.belongsToMany(User, {
  through: UserFlat,
  foreignKey: 'flat_id',
  otherKey: 'user_id',
  as: 'linkedUsers',
})

// User ↔ IncidentReport
User.hasMany(IncidentReport, { foreignKey: 'reporter_id', as: 'reports' })
IncidentReport.belongsTo(User, { foreignKey: 'reporter_id', as: 'reporter' })

// IncidentReport ↔ IncidentAttachment
IncidentReport.hasMany(IncidentAttachment, { foreignKey: 'report_id', as: 'attachments' })
IncidentAttachment.belongsTo(IncidentReport, { foreignKey: 'report_id', as: 'report' })

// IncidentReport ↔ IncidentComment
IncidentReport.hasMany(IncidentComment, { foreignKey: 'report_id', as: 'comments' })
IncidentComment.belongsTo(IncidentReport, { foreignKey: 'report_id', as: 'report' })

// IncidentComment ↔ User (author)
User.hasMany(IncidentComment, { foreignKey: 'author_id', as: 'incidentComments' })
IncidentComment.belongsTo(User, { foreignKey: 'author_id', as: 'author' })

// DiscussionBoard ↔ DiscussionPost
DiscussionBoard.hasMany(DiscussionPost, { foreignKey: 'board_id', as: 'posts' })
DiscussionPost.belongsTo(DiscussionBoard, { foreignKey: 'board_id', as: 'board' })

// DiscussionPost ↔ User (author)
User.hasMany(DiscussionPost, { foreignKey: 'author_id', as: 'posts' })
DiscussionPost.belongsTo(User, { foreignKey: 'author_id', as: 'author' })

// DiscussionPost ↔ PostImage
DiscussionPost.hasMany(PostImage, { foreignKey: 'post_id', as: 'images' })
PostImage.belongsTo(DiscussionPost, { foreignKey: 'post_id', as: 'post' })

// DiscussionPost ↔ PostComment
DiscussionPost.hasMany(PostComment, { foreignKey: 'post_id', as: 'comments' })
PostComment.belongsTo(DiscussionPost, { foreignKey: 'post_id', as: 'post' })

// PostComment ↔ User (author)
User.hasMany(PostComment, { foreignKey: 'author_id', as: 'postComments' })
PostComment.belongsTo(User, { foreignKey: 'author_id', as: 'author' })

// DiscussionPost ↔ PostReaction
DiscussionPost.hasMany(PostReaction, { foreignKey: 'post_id', as: 'reactions' })
PostReaction.belongsTo(DiscussionPost, { foreignKey: 'post_id', as: 'post' })

// PostReaction ↔ User
User.hasMany(PostReaction, { foreignKey: 'user_id', as: 'reactions' })
PostReaction.belongsTo(User, { foreignKey: 'user_id', as: 'user' })

// User ↔ OcDocument
User.hasMany(OcDocument, { foreignKey: 'publisher_id', as: 'publishedDocuments' })
OcDocument.belongsTo(User, { foreignKey: 'publisher_id', as: 'publisher' })

// User ↔ Notification (sender)
User.hasMany(Notification, { foreignKey: 'sender_id', as: 'sentNotifications' })
Notification.belongsTo(User, { foreignKey: 'sender_id', as: 'sender' })

// Notification ↔ UserNotification
Notification.hasMany(UserNotification, { foreignKey: 'notification_id', as: 'recipients' })
UserNotification.belongsTo(Notification, { foreignKey: 'notification_id', as: 'notification' })

// User ↔ UserNotification
User.hasMany(UserNotification, { foreignKey: 'user_id', as: 'notifications' })
UserNotification.belongsTo(User, { foreignKey: 'user_id', as: 'user' })

// User ↔ AuditLog
User.hasMany(AuditLog, { foreignKey: 'user_id', as: 'auditLogs' })
AuditLog.belongsTo(User, { foreignKey: 'user_id', as: 'user' })

// Re-export all models
export {
  Flat,
  User,
  IncidentReport,
  IncidentAttachment,
  IncidentComment,
  DiscussionBoard,
  DiscussionPost,
  PostImage,
  PostComment,
  PostReaction,
  OcDocument,
  Notification,
  UserNotification,
  AuditLog,
  UserFlat,
}
