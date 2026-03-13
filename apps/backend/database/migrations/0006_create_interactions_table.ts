import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  protected tableName = 'interactions'

  async up() {
    this.schema.createTable(this.tableName, (table) => {
      table.uuid('id').primary().defaultTo(this.db.rawQuery('gen_random_uuid()').knexQuery)

      // user_id: CASCADE — interactions appartiennent à l'utilisateur
      table.uuid('user_id').notNullable().references('id').inTable('users').onDelete('CASCADE')

      // prospect_id: NOT NULL, NO CASCADE — soft-delete only pour les prospects
      table.uuid('prospect_id').notNullable().references('id').inTable('prospects')

      // positioning_id: NULLABLE — une interaction peut exister sans positioning
      // SET NULL : si le positioning est hard-deleted (ne devrait pas arriver), l'interaction survive
      table
        .uuid('positioning_id')
        .nullable()
        .references('id')
        .inTable('positionings')
        .onDelete('SET NULL')

      // status: enum restreint par VineJS côté API, stocké en varchar
      table.string('status', 20).notNullable()

      // notes: texte libre, optionnel
      table.text('notes').nullable()

      // interaction_date: date/heure réelle de l'interaction (settée explicitement, pas auto)
      table.timestamp('interaction_date').notNullable().defaultTo(this.now())

      table.timestamp('created_at').notNullable()
      table.timestamp('updated_at').nullable()
      table.timestamp('deleted_at').nullable()

      // Index pour requêtes par prospect (timeline d'un prospect)
      table.index(['user_id', 'prospect_id'], 'idx_interactions_user_prospect')
      // Index pour timeline chronologique
      table.index(['user_id', 'interaction_date'], 'idx_interactions_user_date')
      // Index pour requêtes par positioning (analytics futur)
      table.index(['user_id', 'positioning_id'], 'idx_interactions_user_positioning')
    })
  }

  async down() {
    this.schema.dropTable(this.tableName)
  }
}
