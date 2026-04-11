import { DataTypes, Model, type InferAttributes, type InferCreationAttributes, type CreationOptional, type ForeignKey } from 'sequelize'
import { sequelize } from './sequelize.js'

export class IncidentAttachment extends Model<InferAttributes<IncidentAttachment>, InferCreationAttributes<IncidentAttachment>> {
  declare id: CreationOptional<string>
  declare report_id: ForeignKey<string>
  declare file_path: string
  declare file_type: string
  declare file_size: number
  declare created_at: CreationOptional<Date>
}

IncidentAttachment.init(
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
    file_path: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    file_type: {
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
    tableName: 'incident_attachments',
    underscored: true,
    timestamps: true,
    updatedAt: false,
  },
)
