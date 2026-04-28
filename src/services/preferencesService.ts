import pkg from 'knex';
const { knex } = pkg;
import type { Knex } from 'knex';
import type { ConversationSummary } from '../prompts/v1/summarization.ts';
import type { UserPreferences } from '../prompts/v1/chatResponse.ts';

type UserAccount = {
  userId: string;
  email?: string;
};

function parseFavoriteTechniques(value: unknown): string[] | undefined {
  if (value == null) return undefined;

  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string');
  }

  if (typeof value === 'string') {
    const trimmedValue = value.trim();
    if (!trimmedValue) return undefined;

    try {
      const parsedValue = JSON.parse(trimmedValue);
      return Array.isArray(parsedValue)
        ? parsedValue.filter((item): item is string => typeof item === 'string')
        : undefined;
    } catch (error) {
      console.warn('⚠️ favorite_techniques com JSON inválido, ignorando valor salvo.', error);
      return undefined;
    }
  }

  return undefined;
}

export class PreferencesService {
  private db: Knex;
  private isSetup = false;

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  private requiresSsl(dbUri: string): boolean {
    try {
      const { hostname } = new URL(dbUri)
      return hostname !== 'localhost' && hostname !== '127.0.0.1'
    } catch {
      return false
    }
  }

  constructor(connectionString: string) {
    this.db = knex({
      client: 'pg',
      connection: {
        connectionString,
        ssl: this.requiresSsl(connectionString) ? { rejectUnauthorized: false } : false,
      },
    });
  }

  async setup(): Promise<void> {
    if (this.isSetup) return;

    const hasUsersTable = await this.db.schema.hasTable('user_accounts');

    if (!hasUsersTable) {
      await this.db.schema.createTable('user_accounts', (table) => {
        table.increments('id').primary();
        table.string('user_id').unique().notNullable();
        table.string('email').unique();
        table.timestamp('created_at').defaultTo(this.db.fn.now());
      });
    } else {
      const hasEmail = await this.db.schema.hasColumn('user_accounts', 'email');
      if (!hasEmail) {
        await this.db.schema.alterTable('user_accounts', (table) => {
          table.string('email').unique();
        });
      }

      // Backward-compatible migration: old schema required email; now it is optional.
      await this.db.raw('ALTER TABLE user_accounts ALTER COLUMN email DROP NOT NULL');
    }

    const hasTable = await this.db.schema.hasTable('user_preferences');

    if (!hasTable) {
      await this.db.schema.createTable('user_preferences', (table) => {
        table.increments('id').primary();
        table.string('user_id').unique().notNullable();
        table.string('name');
        table.integer('age');
        table.string('faixa');
        table.json('favorite_techniques');
        table.text('key_preferences');
        table.text('important_context');
        table.timestamp('updated_at').defaultTo(this.db.fn.now());
      });
    } else {
      const hasEmail = await this.db.schema.hasColumn('user_preferences', 'email');
      if (hasEmail) {
        await this.db.schema.alterTable('user_preferences', (table) => {
          table.dropColumn('email');
        });
      }
    }

    this.isSetup = true;
  }

  async getUserByEmail(email: string): Promise<UserAccount | null> {
    await this.setup();

    if (!email.trim()) return null;

    const normalizedEmail = this.normalizeEmail(email);

    const row = await this.db('user_accounts')
      .where({ email: normalizedEmail })
      .first();

    if (!row) return null;

    return {
      userId: row.user_id,
      email: row.email || undefined,
    };
  }

  async createUser(userId: string, email?: string): Promise<void> {
    await this.setup();

    const normalizedEmail = email?.trim()
      ? this.normalizeEmail(email)
      : null;

    await this.db('user_accounts')
      .insert({ user_id: userId, email: normalizedEmail })
      .onConflict('user_id')
      .ignore();
  }

  async linkEmailToUser(userId: string, email: string): Promise<void> {
    await this.setup();

    if (!email.trim()) return;

    const normalizedEmail = this.normalizeEmail(email);

    await this.db('user_accounts')
      .where({ user_id: userId })
      .update({ email: normalizedEmail });
  }

  async userExists(userId: string): Promise<boolean> {
    await this.setup();

    const row = await this.db('user_accounts')
      .where({ user_id: userId })
      .first();

    return !!row;
  }

  async ensurePreferencesRecord(userId: string): Promise<void> {
    await this.setup();

    await this.db('user_preferences')
      .insert({
        user_id: userId,
        updated_at: this.db.fn.now(),
      })
      .onConflict('user_id')
      .ignore();
  }

  async mergePreferences(userId: string, prefs: UserPreferences): Promise<string | undefined> {
    await this.setup();

    if (userId === 'anonymous') {
      if (prefs.email) {
        const account = await this.getUserByEmail(prefs.email);
        userId = account?.userId || userId;
      }

      if (userId === 'anonymous' && prefs.name) {
        userId = prefs.name.toLowerCase().replace(/\s+/g, '_');
      } else if (userId === 'anonymous') {
        return;
      }
    }

    if (prefs.email) {
      try {
        await this.linkEmailToUser(userId, prefs.email);
      } catch {
        // Keep conversation flow working even if email cannot be linked in this step.
      }
    }

    const existing = await this.getSummary(userId);

    const mergedTechniques = prefs.favoriteTechniques?.length
      ? [...new Set([...(existing?.favoriteTechniques || []), ...prefs.favoriteTechniques])]
      : existing?.favoriteTechniques;

    const data = {
      user_id: userId,
      name: prefs.name || existing?.name || null,
      age: prefs.age || existing?.age || null,
      faixa: prefs.faixa || existing?.faixa || null,
      favorite_techniques: mergedTechniques ? JSON.stringify(mergedTechniques) : null,
      key_preferences: existing?.keyPreferences || null,
      updated_at: this.db.fn.now(),
    };

    await this.db('user_preferences')
      .insert(data)
      .onConflict('user_id')
      .merge();

    return userId;
  }

  async storeSummary(userId: string, summary: ConversationSummary): Promise<void> {
    await this.setup();

    if (userId === 'anonymous') {
      if (summary.email) {
        const account = await this.getUserByEmail(summary.email);
        userId = account?.userId || userId;
      }

      if (userId === 'anonymous' && summary.name) {
        userId = summary.name.toLowerCase().replace(/\s+/g, '_');
      } else if (userId === 'anonymous') {
        return;
      }
    }

    if (summary.email) {
      try {
        await this.linkEmailToUser(userId, summary.email);
      } catch {
        // Keep conversation flow working even if email cannot be linked in this step.
      }
    }

    const existing = await this.getSummary(userId);

    const mergedTechniques = summary.favoriteTechniques?.length
      ? [...new Set([...(existing?.favoriteTechniques || []), ...summary.favoriteTechniques])]
      : existing?.favoriteTechniques;

    const data = {
      user_id: userId,
      name: summary.name || existing?.name || null,
      age: summary.age || existing?.age || null,
      faixa: summary.faixa || existing?.faixa || null,
      favorite_techniques: mergedTechniques ? JSON.stringify(mergedTechniques) : null,
      key_preferences: summary.keyPreferences,
      important_context: summary.importantContext || existing?.importantContext || null,
      updated_at: this.db.fn.now(),
    };

    await this.db('user_preferences')
      .insert(data)
      .onConflict('user_id')
      .merge();
  }

  async getSummary(userId: string): Promise<ConversationSummary | null> {
    await this.setup();

    const row = await this.db('user_preferences as up')
      .leftJoin('user_accounts as ua', 'ua.user_id', 'up.user_id')
      .select(
        'up.name',
        'ua.email',
        'up.age',
        'up.faixa',
        'up.favorite_techniques',
        'up.key_preferences',
        'up.important_context',
      )
      .where({ 'up.user_id': userId })
      .first();

    if (!row) return null;

    return {
      name: row.name || undefined,
      email: row.email || undefined,
      age: row.age || undefined,
      faixa: row.faixa || undefined,
      favoriteTechniques: parseFavoriteTechniques(row.favorite_techniques),
      keyPreferences: row.key_preferences,
      importantContext: row.important_context || undefined,
    };
  }

  async getBasicInfo(userId: string): Promise<string | undefined> {
    const summary = await this.getSummary(userId);
    if (!summary) return undefined;

    const parts: string[] = [];

    if (summary.name) parts.push(`Nome: ${summary.name}`);
    if (summary.email) parts.push(`Email: ${summary.email}`);
    if (summary.favoriteTechniques?.length) {
      parts.push(`Técnicas Favoritas: ${summary.favoriteTechniques.join(', ')}`);
    }
    if (summary.age) {
      parts.push(`Idade: ${summary.age}`);
    }
    if (summary.faixa) {
      parts.push(`Faixa: ${summary.faixa}`);
    }
    if (summary.keyPreferences) {
      parts.push(`\nPreferências: ${summary.keyPreferences}`);
    }

    return parts.length > 0 ? parts.join('\n') : undefined;
  }

  async close(): Promise<void> {
    await this.db.destroy();
  }
}
