import { DataTypes, Model, type InferAttributes, type InferCreationAttributes, type CreationOptional, type ForeignKey } from 'sequelize'
import { sequelize } from './sequelize.js'

export class IncidentComment extends Model<InferAttributes<IncidentComment>, InferCreationAttributes<IncidentComment>> {
  declare id: CreationOptional<string>
  declare report_id: ForeignKey<string>
  declare author_id: ForeignKey<string>
  declare content: string
  declare is_internal: CreationOptional<boolean>
  declare created_at: CreationOptional<Date>
}

IncidentComment.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    report_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'incident_reports',
        key: 'id',
      },
      onDelete: 'CASCADE',
    },
    author_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    is_internal: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    created_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'incident_comments',
    underscored: true,
    timestamps: true,
    updatedAt: false,
  },
)
