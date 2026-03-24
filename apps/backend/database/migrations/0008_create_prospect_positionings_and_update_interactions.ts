import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    // ─── 1. Create prospect_positionings table ─────────────────────────────────
    this.schema.createTable('prospect_positionings', (table) => {
      table.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)

      // user_id: CASCADE — prospect_positionings belong to the user
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')

      // prospect_id: no CASCADE — prospects use soft-delete only (DB row always exists)
      table.uuid('prospect_id').notNullable().references('id').inTable('prospects')

      // positioning_id: no CASCADE — positionings use soft-delete only
      table.uuid('positioning_id').notNullable().references('id').inTable('positionings')

      // funnel_stage_id: denormalized from positioning.funnel_stage_id — no CASCADE (stages soft-delete only)
      table.uuid('funnel_stage_id').notNullable().references('id').inTable('funnel_stages')

      // outcome: null = in-progress | 'success' | 'failed' — always set explicitly by user
      table.string('outcome', 10).nullable()

      table.timestamp('created_at').notNullable()

      // UNIQUE: max 1 positioning per prospect per stage
      // Assigning a new positioning for the same stage = delete + insert (hard delete of old row)
      table.unique(
        ['user_id', 'prospect_id', 'funnel_stage_id'],
        'uq_prospect_positionings_user_prospect_stage',
      )

      // Index for active positioning lookup: WHERE prospect_id = X AND funnel_stage_id = prospect.funnel_stage_id
      table.index(['user_id', 'prospect_id', 'funnel_stage_id'], 'idx_prospect_positionings_active')

      // Index for FR16: all prospects that used a given positioning
      table.index(['user_id', 'positioning_id'], 'idx_prospect_positionings_positioning')
    })

    // ─── 2. Add funnel_stage_id to interactions (nullable for backfill) ────────
    this.schema.alterTable('interactions', (table) => {
      // nullable first — will be backfilled then made NOT NULL via deferred raw SQL
      table.uuid('funnel_stage_id').nullable().references('id').inTable('funnel_stages')

      // Index for filtering interactions by funnel stage
      table.index(['user_id', 'funnel_stage_id'], 'idx_interactions_user_funnel_stage')
    })

    // ─── 3. Backfill funnel_stage_id from prospect's current stage ─────────────
    this.defer(async (db) => {
      // All prospects (active or soft-deleted) always have funnel_stage_id — safe JOIN
      await db.rawQuery(`
        UPDATE interactions
        SET funnel_stage_id = prospects.funnel_stage_id
        FROM prospects
        WHERE interactions.prospect_id = prospects.id
      `)
    })

    // ─── 4. Make funnel_stage_id NOT NULL after backfill ──────────────────────
    this.defer(async (db) => {
      await db.rawQuery('ALTER TABLE interactions ALTER COLUMN funnel_stage_id SET NOT NULL')
    })
  }

  async down() {
    this.schema.dropTable('prospect_positionings')

    this.schema.alterTable('interactions', (table) => {
      table.dropIndex([], 'idx_interactions_user_funnel_stage')
      table.dropColumn('funnel_stage_id')
    })
  }
}
