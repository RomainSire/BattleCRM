import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.createTable('battles', (table) => {
      table.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)

      // user_id: CASCADE — losing a user removes all their battles
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')

      // funnel_stage_id: no CASCADE — stages use soft-delete only
      table.uuid('funnel_stage_id').notNullable().references('id').inTable('funnel_stages')

      // variant_a_id / variant_b_id: no CASCADE — positionings use soft-delete only
      table.uuid('variant_a_id').notNullable().references('id').inTable('positionings')
      table.uuid('variant_b_id').notNullable().references('id').inTable('positionings')

      // battle_number: application-managed, sequential per (user_id, funnel_stage_id)
      table.integer('battle_number').notNullable()

      // status: 'active' | 'closed'
      table.string('status', 10).notNullable()

      // winner_id: nullable FK — set when battle is closed and winner confirmed
      table.uuid('winner_id').nullable().references('id').inTable('positionings')

      table.timestamp('started_at').notNullable()
      table.timestamp('closed_at').nullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()

      // Composite index for filtering by user + stage + status (analytics queries)
      table.index(['user_id', 'funnel_stage_id', 'status'], 'idx_battles_user_stage_status')
    })

    // Partial unique index: only one ACTIVE battle allowed per (user_id, funnel_stage_id).
    // Standard table.unique() does not support WHERE clauses — raw SQL required.
    this.defer(async (db) => {
      await db.rawQuery(`
        CREATE UNIQUE INDEX uq_battles_one_active_per_stage
        ON battles (user_id, funnel_stage_id)
        WHERE status = 'active'
      `)
    })
  }

  async down() {
    this.defer(async (db) => {
      await db.rawQuery('DROP INDEX IF EXISTS uq_battles_one_active_per_stage')
    })

    this.schema.dropTable('battles')
  }
}
