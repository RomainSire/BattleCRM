import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'positionings'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')

      // funnel_stage_id: required FK — no CASCADE (stages are soft-deleted only, DB row always exists)
      table.uuid('funnel_stage_id').notNullable().references('id').inTable('funnel_stages')

      table.string('name', 255).notNullable()
      table.text('description').nullable()
      table.text('content').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
      table.timestamp('deleted_at').nullable()

      // Index for efficient per-user soft-delete filtering (used by forUser scope + default list queries)
      table.index(['user_id', 'deleted_at'], 'idx_positionings_user_deleted')
      // Index for filtering positionings by funnel stage (Story 4.3: list view with stage filter)
      table.index(
        ['user_id', 'deleted_at', 'funnel_stage_id'],
        'idx_positionings_user_deleted_stage',
      )
    })

    // Backfill FK on prospects.positioning_id — promised in migration 0003 with comment:
    // "FK will be added in that migration via: ALTER TABLE prospects ADD CONSTRAINT..."
    this.schema.alterTable('prospects', (table) => {
      table
        .foreign('positioning_id', 'fk_prospects_positioning')
        .references('id')
        .inTable('positionings')
        .onDelete('SET NULL')
    })
  }

  async down() {
    // Drop FK constraint first (before dropping the referenced positionings table)
    this.schema.alterTable('prospects', (table) => {
      table.dropForeign('positioning_id', 'fk_prospects_positioning')
    })
    this.schema.dropTable(this.tableName)
  }
}
