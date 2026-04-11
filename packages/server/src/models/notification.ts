import { DataTypes, Model, type InferAttributes, type InferCreationAttributes, type CreationOptional, type ForeignKey } from 'sequelize'
import { sequelize } from './sequelize.js'

export class Notification extends Model<InferAttributes<Notification>, InferCreationAttributes<Notification>> {
  declare id: CreationOptional<string>
  declare sender_id: ForeignKey<string>
  declare title: string
  declare body: string
  declare category: 'urgent' | 'general' | 'event'
  declare target_type: 'all' | 'block' | 'floor'
  declare target_block: string | null
  declare target_floor: string | null
  declare created_at: CreationOptional<Date>
  declare updated_at: CreationOptional<Date>
}

Notification.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    sender_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    body: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    category: {
      type: DataTypes.ENUM('urgent', 'general', 'event'),
      allowNull: false,
    },
    target_type: {
      type: DataTypes.ENUM('all', 'block', 'floor'),
      allowNull: false,
    },
    target_block: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    target_floor: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'notifications',
    underscored: true,
    timestamps: true,
  },
)
