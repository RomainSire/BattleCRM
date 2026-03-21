import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'prospects'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('positioning_id')
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.uuid('positioning_id').nullable()
    })
  }
}
