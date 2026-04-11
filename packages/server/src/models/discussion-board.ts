import { DataTypes, Model, type InferAttributes, type InferCreationAttributes, type CreationOptional } from 'sequelize'
import { sequelize } from './sequelize.js'

export class DiscussionBoard extends Model<InferAttributes<DiscussionBoard>, InferCreationAttributes<DiscussionBoard>> {
  declare id: CreationOptional<string>
  declare name: string
  declare scope_type: 'estate' | 'block' | 'floor'
  declare scope_block: string | null
  declare scope_floor: string | null
  declare created_at: CreationOptional<Date>
}

DiscussionBoard.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    scope_type: {
      type: DataTypes.ENUM('estate', 'block', 'floor'),
      allowNull: false,
    },
    scope_block: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    scope_floor: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    created_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'discussion_boards',
    underscored: true,
    timestamps: true,
    updatedAt: false,
  },
)
