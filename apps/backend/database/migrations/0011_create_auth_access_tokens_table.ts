import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'auth_access_tokens'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.increments('id').unsigned().primary()
      table.uuid('tokenable_id').notNullable().references('id').inTable('users').onDelete('CASCADE')
      table.string('type').notNullable()
      table.string('name').nullable()
      table.string('hash', 200).notNullable().unique()
      table.text('abilities').notNullable()
      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
      table.timestamp('last_used_at').nullable()
      table.timestamp('expires_at').nullable()

      table.index(['tokenable_id', 'type'], 'idx_auth_access_tokens_tokenable_type')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
