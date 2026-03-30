import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    await this.schema.raw(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_prospects_user_linkedin
       ON prospects (user_id, linkedin_url)
       WHERE linkedin_url IS NOT NULL AND deleted_at IS NULL`,
    )
  }

  async down() {
    await this.schema.raw('DROP INDEX IF EXISTS idx_prospects_user_linkedin')
  }
}
