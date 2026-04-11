import { DataTypes, Model, type InferAttributes, type InferCreationAttributes, type CreationOptional, type ForeignKey } from 'sequelize'
import { sequelize } from './sequelize.js'

export class IncidentReport extends Model<InferAttributes<IncidentReport>, InferCreationAttributes<IncidentReport>> {
  declare id: CreationOptional<string>
  declare reporter_id: ForeignKey<string>
  declare type: 'repair' | 'complaint' | 'inquiry'
  declare title: string
  declare description: string
  declare location_block: string | null
  declare location_floor: string | null
  declare location_area: string | null
  declare status: CreationOptional<'pending' | 'in_progress' | 'completed'>
  declare priority: 'low' | 'medium' | 'high' | 'urgent' | null
  declare created_at: CreationOptional<Date>
  declare updated_at: CreationOptional<Date>
}

IncidentReport.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    reporter_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    type: {
      type: DataTypes.ENUM('repair', 'complaint', 'inquiry'),
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    location_block: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    location_floor: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    location_area: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM('pending', 'in_progress', 'completed'),
      allowNull: false,
      defaultValue: 'pending',
    },
    priority: {
      type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
      allowNull: true,
    },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'incident_reports',
    underscored: true,
    timestamps: true,
  },
)
