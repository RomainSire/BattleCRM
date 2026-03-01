import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'prospect_stage_transitions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
      table
        .uuid('prospect_id')
        .notNullable()
        .references('id')
        .inTable('prospects')
        .onDelete('CASCADE')

      // from_stage_id: nullable — null means initial stage assignment (no "from")
      // funnel_stages are only ever soft-deleted — DB row always exists, FK is safe
      table.uuid('from_stage_id').nullable().references('id').inTable('funnel_stages')
      table.uuid('to_stage_id').notNullable().references('id').inTable('funnel_stages')

      table.timestamp('transitioned_at').notNullable()
      table.timestamp('created_at').notNullable()

      // Index for per-prospect history queries (chronological ordering)
      table.index(['prospect_id', 'transitioned_at'], 'idx_stage_transitions_prospect_time')
      // Index for user-scoped queries (security boundary)
      table.index(['user_id', 'prospect_id'], 'idx_stage_transitions_user_prospect')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
