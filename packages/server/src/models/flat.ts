import { DataTypes, Model, type InferAttributes, type InferCreationAttributes, type CreationOptional } from 'sequelize'
import { sequelize } from './sequelize.js'

export class Flat extends Model<InferAttributes<Flat>, InferCreationAttributes<Flat>> {
  declare id: CreationOptional<string>
  declare block: string
  declare floor: string
  declare unit_number: string
  declare registration_password: string
  declare is_registration_open: CreationOptional<boolean>
  declare created_at: CreationOptional<Date>
  declare updated_at: CreationOptional<Date>
}

Flat.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    block: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    floor: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    unit_number: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    registration_password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    is_registration_open: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'flats',
    underscored: true,
    timestamps: true,
  },
)
