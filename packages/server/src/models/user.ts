import { DataTypes, Model, type InferAttributes, type InferCreationAttributes, type CreationOptional, type ForeignKey } from 'sequelize'
import { sequelize } from './sequelize.js'

export class User extends Model<InferAttributes<User>, InferCreationAttributes<User>> {
  declare id: CreationOptional<string>
  declare email: string
  declare phone: string | null
  declare password_hash: string
  declare name: string
  declare flat_id: ForeignKey<string> | null
  declare role: 'resident' | 'oc_committee' | 'mgmt_staff' | 'admin'
  declare is_active: CreationOptional<boolean>
  declare created_at: CreationOptional<Date>
  declare updated_at: CreationOptional<Date>
}

User.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    phone: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    password_hash: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    flat_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: 'flats',
        key: 'id',
      },
    },
    role: {
      type: DataTypes.ENUM('resident', 'oc_committee', 'mgmt_staff', 'admin'),
      allowNull: false,
      defaultValue: 'resident',
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
    },
    created_at: DataTypes.DATE,
    updated_at: DataTypes.DATE,
  },
  {
    sequelize,
    tableName: 'users',
    underscored: true,
    timestamps: true,
  },
)
