import { DataTypes, Model, type InferAttributes, type InferCreationAttributes, type CreationOptional, type ForeignKey } from 'sequelize'
import { sequelize } from './sequelize.js'

export class UserFlat extends Model<InferAttributes<UserFlat>, InferCreationAttributes<UserFlat>> {
  declare user_id: ForeignKey<string>
  declare flat_id: ForeignKey<string>
  declare linked_at: CreationOptional<Date>
}

UserFlat.init(
  {
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      references: { model: 'users', key: 'id' },
    },
    flat_id: {
      type: DataTypes.UUID,
      allowNull: false,
      primaryKey: true,
      references: { model: 'flats', key: 'id' },
    },
    linked_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    sequelize,
    tableName: 'user_flats',
    underscored: true,
    timestamps: false,
  },
)
