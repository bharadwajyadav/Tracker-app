import React, { useState } from 'react';
import { supabase } from '../lib/supabase';

export default function UsernameSetup({ session, onComplete }) {
  const [username, setUsername] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    const u = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
    if (u.length < 3) { setError('Username must be at least 3 characters'); return; }
    setLoading(true); setError('');
    const { data: existing } = await supabase.from('profiles').select('id').eq('username', u).single();
    if (existing) { setError('Username already taken'); setLoading(false); return; }
    const avatarUrl = session.user.user_metadata?.avatar_url || null;
    const { data, error } = await supabase.from('profiles').insert({
      id: session.user.id,
      username: u,
      avatar_url: avatarUrl
    }).select().single();
    if (error) { setError(error.message); setLoading(false); return; }
    onComplete(data);
  }

  return (
    <div className="setup-screen">
      <div className="setup-box">
        <div className="setup-title">Pick a username</div>
        <div className="setup-sub">this is how friends will find you</div>
        <form onSubmit={handleSubmit}>
          <input
            className="setup-input"
            placeholder="e.g. bharadwaj"
            value={username}
            onChange={e => setUsername(e.target.value)}
            autoFocus
          />
          <button className="setup-btn" type="submit" disabled={loading || username.trim().length < 3}>
            {loading ? 'Setting up...' : 'Get started →'}
          </button>
          {error && <div className="setup-error">{error}</div>}
        </form>
      </div>
    </div>
  );
}
