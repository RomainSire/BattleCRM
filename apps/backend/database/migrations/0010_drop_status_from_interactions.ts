import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'interactions'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('status')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.enu('status', ['positive', 'pending', 'negative']).notNullable().defaultTo('pending')
    })
  }
}
