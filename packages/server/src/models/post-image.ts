import { DataTypes, Model, type InferAttributes, type InferCreationAttributes, type CreationOptional, type ForeignKey } from 'sequelize'
import { sequelize } from './sequelize.js'

export class PostImage extends Model<InferAttributes<PostImage>, InferCreationAttributes<PostImage>> {
  declare id: CreationOptional<string>
  declare post_id: ForeignKey<string>
  declare file_path: string
  declare file_size: number
  declare created_at: CreationOptional<Date>
}

PostImage.init(
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
    file_path: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    file_size: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    created_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'post_images',
    underscored: true,
    timestamps: true,
    updatedAt: false,
  },
)
