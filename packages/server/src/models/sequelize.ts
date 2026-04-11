import { Sequelize } from 'sequelize'
import { config } from '../config/index.js'

export const sequelize = new Sequelize(config.databaseUrl, {
  dialect: 'postgres',
  logging: config.nodeEnv === 'development' ? console.log : false,
  define: {
    underscored: true,
    timestamps: true,
  },
})
