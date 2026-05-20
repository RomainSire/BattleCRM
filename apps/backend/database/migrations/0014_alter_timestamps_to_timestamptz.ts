import { BaseSchema } from '@adonisjs/lucid/schema'

export default class extends BaseSchema {
  async up() {
    await this.db.rawQuery(`
      ALTER TABLE users
        ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
        ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC',
        ALTER COLUMN deleted_at TYPE TIMESTAMPTZ USING deleted_at AT TIME ZONE 'UTC'
    `)

    await this.db.rawQuery(`
      ALTER TABLE funnel_stages
        ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
        ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC',
        ALTER COLUMN deleted_at TYPE TIMESTAMPTZ USING deleted_at AT TIME ZONE 'UTC'
    `)

    await this.db.rawQuery(`
      ALTER TABLE prospects
        ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
        ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC',
        ALTER COLUMN deleted_at TYPE TIMESTAMPTZ USING deleted_at AT TIME ZONE 'UTC'
    `)

    await this.db.rawQuery(`
      ALTER TABLE prospect_stage_transitions
        ALTER COLUMN transitioned_at TYPE TIMESTAMPTZ USING transitioned_at AT TIME ZONE 'UTC',
        ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC'
    `)

    await this.db.rawQuery(`
      ALTER TABLE positionings
        ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
        ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC',
        ALTER COLUMN deleted_at TYPE TIMESTAMPTZ USING deleted_at AT TIME ZONE 'UTC'
    `)

    await this.db.rawQuery(`
      ALTER TABLE interactions
        ALTER COLUMN interaction_date TYPE TIMESTAMPTZ USING interaction_date AT TIME ZONE 'UTC',
        ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
        ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC'
    `)

    await this.db.rawQuery(`
      ALTER TABLE prospect_positionings
        ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC'
    `)

    await this.db.rawQuery(`
      ALTER TABLE auth_access_tokens
        ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
        ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC',
        ALTER COLUMN last_used_at TYPE TIMESTAMPTZ USING last_used_at AT TIME ZONE 'UTC',
        ALTER COLUMN expires_at TYPE TIMESTAMPTZ USING expires_at AT TIME ZONE 'UTC'
    `)

    await this.db.rawQuery(`
      ALTER TABLE battles
        ALTER COLUMN started_at TYPE TIMESTAMPTZ USING started_at AT TIME ZONE 'UTC',
        ALTER COLUMN closed_at TYPE TIMESTAMPTZ USING closed_at AT TIME ZONE 'UTC',
        ALTER COLUMN created_at TYPE TIMESTAMPTZ USING created_at AT TIME ZONE 'UTC',
        ALTER COLUMN updated_at TYPE TIMESTAMPTZ USING updated_at AT TIME ZONE 'UTC'
    `)
  }

  async down() {
    await this.db.rawQuery(`
      ALTER TABLE users
        ALTER COLUMN created_at TYPE TIMESTAMP USING created_at AT TIME ZONE 'UTC',
        ALTER COLUMN updated_at TYPE TIMESTAMP USING updated_at AT TIME ZONE 'UTC',
        ALTER COLUMN deleted_at TYPE TIMESTAMP USING deleted_at AT TIME ZONE 'UTC'
    `)

    await this.db.rawQuery(`
      ALTER TABLE funnel_stages
        ALTER COLUMN created_at TYPE TIMESTAMP USING created_at AT TIME ZONE 'UTC',
        ALTER COLUMN updated_at TYPE TIMESTAMP USING updated_at AT TIME ZONE 'UTC',
        ALTER COLUMN deleted_at TYPE TIMESTAMP USING deleted_at AT TIME ZONE 'UTC'
    `)

    await this.db.rawQuery(`
      ALTER TABLE prospects
        ALTER COLUMN created_at TYPE TIMESTAMP USING created_at AT TIME ZONE 'UTC',
        ALTER COLUMN updated_at TYPE TIMESTAMP USING updated_at AT TIME ZONE 'UTC',
        ALTER COLUMN deleted_at TYPE TIMESTAMP USING deleted_at AT TIME ZONE 'UTC'
    `)

    await this.db.rawQuery(`
      ALTER TABLE prospect_stage_transitions
        ALTER COLUMN transitioned_at TYPE TIMESTAMP USING transitioned_at AT TIME ZONE 'UTC',
        ALTER COLUMN created_at TYPE TIMESTAMP USING created_at AT TIME ZONE 'UTC'
    `)

    await this.db.rawQuery(`
      ALTER TABLE positionings
        ALTER COLUMN created_at TYPE TIMESTAMP USING created_at AT TIME ZONE 'UTC',
        ALTER COLUMN updated_at TYPE TIMESTAMP USING updated_at AT TIME ZONE 'UTC',
        ALTER COLUMN deleted_at TYPE TIMESTAMP USING deleted_at AT TIME ZONE 'UTC'
    `)

    await this.db.rawQuery(`
      ALTER TABLE interactions
        ALTER COLUMN interaction_date TYPE TIMESTAMP USING interaction_date AT TIME ZONE 'UTC',
        ALTER COLUMN created_at TYPE TIMESTAMP USING created_at AT TIME ZONE 'UTC',
        ALTER COLUMN updated_at TYPE TIMESTAMP USING updated_at AT TIME ZONE 'UTC'
    `)

    await this.db.rawQuery(`
      ALTER TABLE prospect_positionings
        ALTER COLUMN created_at TYPE TIMESTAMP USING created_at AT TIME ZONE 'UTC'
    `)

    await this.db.rawQuery(`
      ALTER TABLE auth_access_tokens
        ALTER COLUMN created_at TYPE TIMESTAMP USING created_at AT TIME ZONE 'UTC',
        ALTER COLUMN updated_at TYPE TIMESTAMP USING updated_at AT TIME ZONE 'UTC',
        ALTER COLUMN last_used_at TYPE TIMESTAMP USING last_used_at AT TIME ZONE 'UTC',
        ALTER COLUMN expires_at TYPE TIMESTAMP USING expires_at AT TIME ZONE 'UTC'
    `)

    await this.db.rawQuery(`
      ALTER TABLE battles
        ALTER COLUMN started_at TYPE TIMESTAMP USING started_at AT TIME ZONE 'UTC',
        ALTER COLUMN closed_at TYPE TIMESTAMP USING closed_at AT TIME ZONE 'UTC',
        ALTER COLUMN created_at TYPE TIMESTAMP USING created_at AT TIME ZONE 'UTC',
        ALTER COLUMN updated_at TYPE TIMESTAMP USING updated_at AT TIME ZONE 'UTC'
    `)
  }
}
