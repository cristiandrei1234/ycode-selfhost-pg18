import type { Knex } from 'knex';

/**
 * Migration: Index form submissions by client IP
 *
 * Supports the per-IP rate limit on the public submission endpoint, which
 * counts recent submissions from the same IP on every request.
 */

export async function up(knex: Knex): Promise<void> {
  await knex.schema.raw(`
    CREATE INDEX IF NOT EXISTS idx_form_submissions_ip_created
    ON form_submissions((metadata->>'ip'), created_at DESC)
  `);
}

export async function down(knex: Knex): Promise<void> {
  await knex.schema.raw('DROP INDEX IF EXISTS idx_form_submissions_ip_created');
}
