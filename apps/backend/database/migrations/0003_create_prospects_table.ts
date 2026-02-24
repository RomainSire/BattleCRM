import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'prospects'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.uuid('funnel_stage_id').notNullable().references('id').inTable('funnel_stages')
      // No onDelete: funnel_stages are only ever soft-deleted — the DB row always exists,
      // so the FK reference remains valid. RESTRICT (default) is a safe fallback
      // that prevents accidental hard-deletes of stages that have prospects.

      // positioning_id: nullable UUID, NO FK constraint yet.
      // The positionings table is created in Epic 4 (Story 4.1).
      // FK will be added in that migration via:
      //   ALTER TABLE prospects ADD CONSTRAINT fk_prospects_positioning
      //   FOREIGN KEY (positioning_id) REFERENCES positionings(id) ON DELETE SET NULL
      table.uuid('positioning_id').nullable()

      table.string('name', 255).notNullable()
      table.string('company', 255).nullable()
      table.string('linkedin_url', 500).nullable()
      table.string('email', 255).nullable()
      table.string('phone', 50).nullable()
      table.string('title', 255).nullable()
      table.text('notes').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
      table.timestamp('deleted_at').nullable()

      // Index for efficient per-user soft-delete filtering (used by forUser scope + default list queries)
      table.index(['user_id', 'deleted_at'], 'idx_prospects_user_deleted')

      // Index for filtering prospects by funnel stage (FR6: filter prospects by funnel stage)
      table.index(['user_id', 'funnel_stage_id'], 'idx_prospects_user_stage')
    })
  }

  async down() {
    this.schema.raw('DROP INDEX IF EXISTS idx_prospects_user_stage')
    this.schema.raw('DROP INDEX IF EXISTS idx_prospects_user_deleted')
    this.schema.dropTable(this.tableName)
  }
}
