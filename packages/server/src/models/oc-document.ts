import { DataTypes, Model, type InferAttributes, type InferCreationAttributes, type CreationOptional, type ForeignKey } from 'sequelize'
import { sequelize } from './sequelize.js'

export class OcDocument extends Model<InferAttributes<OcDocument>, InferCreationAttributes<OcDocument>> {
  declare id: CreationOptional<string>
  declare publisher_id: ForeignKey<string>
  declare type: 'meeting_minutes' | 'financial_statement' | 'resolution' | 'notice'
  declare title: string
  declare description: string | null
  declare file_path: string
  declare year: number
  declare created_at: CreationOptional<Date>
  declare updated_at: CreationOptional<Date>
}

OcDocument.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    publisher_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: 'users',
        key: 'id',
      },
    },
    type: {
      type: DataTypes.ENUM('meeting_minutes', 'financial_statement', 'resolution', 'notice'),
      allowNull: false,
    },
    title: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    file_path: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    year: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'oc_documents',
    underscored: true,
    timestamps: true,
  },
)
