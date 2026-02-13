import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    this.schema.raw('ALTER TABLE users ENABLE ROW LEVEL SECURITY')
    this.schema.raw('ALTER TABLE users FORCE ROW LEVEL SECURITY')

    // Users can only SELECT their own row
    // Guard: short-circuit to false if app.current_user_id is empty (avoids uuid cast error)
    this.schema.raw(`
      CREATE POLICY users_select_own ON users
        FOR SELECT
        USING (
          current_setting('app.current_user_id', true) != ''
          AND id = current_setting('app.current_user_id', true)::uuid
        )
    `)

    // Users can only UPDATE their own row
    this.schema.raw(`
      CREATE POLICY users_update_own ON users
        FOR UPDATE
        USING (
          current_setting('app.current_user_id', true) != ''
          AND id = current_setting('app.current_user_id', true)::uuid
        )
        WITH CHECK (
          current_setting('app.current_user_id', true) != ''
          AND id = current_setting('app.current_user_id', true)::uuid
        )
    `)

    // Allow INSERT for registration (no user_id check needed)
    this.schema.raw(`
      CREATE POLICY users_insert_allow ON users
        FOR INSERT
        WITH CHECK (true)
    `)

    // No DELETE policy = hard deletes denied by RLS (soft delete only)
  }

  async down() {
    this.schema.raw('DROP POLICY IF EXISTS users_insert_allow ON users')
    this.schema.raw('DROP POLICY IF EXISTS users_update_own ON users')
    this.schema.raw('DROP POLICY IF EXISTS users_select_own ON users')
    this.schema.raw('ALTER TABLE users DISABLE ROW LEVEL SECURITY')
  }
}
