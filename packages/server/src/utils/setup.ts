import { config } from '../config/index.js'
import { User } from '../models/index.js'
import { hashPassword } from '../utils/hash.js'

export async function ensureAdminAccount(): Promise<void> {
  const existing = await User.findOne({ where: { email: config.adminEmail } })
  if (existing) {
    return
  }

  const passwordHash = await hashPassword(config.adminPassword)
  await User.create({
    email: config.adminEmail,
    phone: null,
    password_hash: passwordHash,
    name: config.adminName,
    flat_id: null,
    role: 'admin',
    is_active: true,
  })

  console.log(`Admin account created: ${config.adminEmail}`)
}
