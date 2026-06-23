import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'prospects'

  async up() {
    this.schema.alterTable(this.tableName, (table) => {
      table.string('needed_role', 255).nullable()
    })
  }

  async down() {
    this.schema.alterTable(this.tableName, (table) => {
      table.dropColumn('needed_role')
    })
  }
}
