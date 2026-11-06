import type { SupabaseClient } from '@supabase/supabase-js';
import type { RefreshTokenStore } from '../../core/use-cases/refresh-token.usecase';

export class SupabaseRefreshTokenStore implements RefreshTokenStore {
  constructor(private readonly db: SupabaseClient) {}

  async create(userId: string, tokenHash: string, expiresAt: string): Promise<void> {
    const { error } = await this.db
      .from('identity_refresh_tokens')
      .insert({ user_id: userId, token_hash: tokenHash, expires_at: expiresAt });
    if (error) throw error;
  }

  async findValidByHash(tokenHash: string): Promise<{ userId: string } | null> {
    const { data, error } = await this.db
      .from('identity_refresh_tokens')
      .select('user_id, expires_at, revoked')
      .eq('token_hash', tokenHash)
      .eq('revoked', false)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    if (new Date(data.expires_at) < new Date()) return null;
    return { userId: data.user_id };
  }

  async revokeByHash(tokenHash: string): Promise<void> {
    const { error } = await this.db
      .from('identity_refresh_tokens')
      .update({ revoked: true })
      .eq('token_hash', tokenHash);
    if (error) throw error;
  }
}
