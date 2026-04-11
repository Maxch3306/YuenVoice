import { DataTypes, Model, type InferAttributes, type InferCreationAttributes, type CreationOptional, type ForeignKey } from 'sequelize'
import { sequelize } from './sequelize.js'

export class PostReaction extends Model<InferAttributes<PostReaction>, InferCreationAttributes<PostReaction>> {
  declare id: CreationOptional<string>
  declare post_id: ForeignKey<string>
  declare user_id: ForeignKey<string>
  declare type: 'like'
  declare created_at: CreationOptional<Date>
}

PostReaction.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    post_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'discussion_posts',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    type: {
      type: DataTypes.ENUM('like'),
      allowNull: false,
    },
    created_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'post_reactions',
    underscored: true,
    timestamps: true,
    updatedAt: false,
    indexes: [
      {
        unique: true,
        fields: ['post_id', 'user_id', 'type'],
      },
    ],
  },
)
