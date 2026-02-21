import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'funnel_stages'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.string('name', 255).notNullable()
      table.integer('position').notNullable()

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
      table.timestamp('deleted_at').nullable()

      // Index for efficient per-user queries (filtering by deleted_at)
      table.index(['user_id', 'deleted_at'], 'idx_funnel_stages_user_deleted')
    })

    // Partial unique index: enforce unique positions only for active (non-deleted) stages
    // Cannot be done via Knex table builder — must use raw SQL
    // No await: queue on same schema builder so it runs after createTable
    this.schema.raw(
      'CREATE UNIQUE INDEX idx_funnel_stages_user_position_active ON funnel_stages (user_id, position) WHERE deleted_at IS NULL',
    )
  }

  async down() {
    this.schema.raw('DROP INDEX IF EXISTS idx_funnel_stages_user_position_active')
    this.schema.raw('DROP INDEX IF EXISTS idx_funnel_stages_user_deleted')
    this.schema.dropTable(this.tableName)
  }
}
