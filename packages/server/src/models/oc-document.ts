import { DataTypes, Model, type InferAttributes, type InferCreationAttributes, type CreationOptional, type ForeignKey } from 'sequelize'
import { sequelize } from './sequelize.js'

export type OcDocumentType =
  | 'meeting_minutes'
  | 'financial_statement'
  | 'resolution'
  | 'notice'
  | 'meeting_livestream'
  | 'meeting_recording'

export type OcDocumentLinkType = 'google_meet' | 'google_drive' | 'google_site'

export class OcDocument extends Model<InferAttributes<OcDocument>, InferCreationAttributes<OcDocument>> {
  declare id: CreationOptional<string>
  declare publisher_id: ForeignKey<string>
  declare type: OcDocumentType
  declare title: string
  declare description: string | null
  declare file_path: string | null
  declare external_url: string | null
  declare link_type: OcDocumentLinkType | null
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
      type: DataTypes.ENUM(
        'meeting_minutes',
        'financial_statement',
        'resolution',
        'notice',
        'meeting_livestream',
        'meeting_recording',
      ),
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
      allowNull: true,
    },
    external_url: {
      type: DataTypes.STRING(1024),
      allowNull: true,
    },
    link_type: {
      type: DataTypes.ENUM('google_meet', 'google_drive', 'google_site'),
      allowNull: true,
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
