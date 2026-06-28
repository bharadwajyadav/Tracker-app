import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import ConsistencyGrid from './ConsistencyGrid';

export default function SocialView({ profile }) {
  const [tab, setTab] = useState('friends'); // friends | leaderboard | grids
  const [friendUsername, setFriendUsername] = useState('');
  const [friendships, setFriendships] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]);
  const [friendGrids, setFriendGrids] = useState([]);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => { fetchFriendships(); }, []);
  useEffect(() => { if (tab === 'leaderboard') fetchLeaderboard(); }, [tab]);
  useEffect(() => { if (tab === 'grids') fetchFriendGrids(); }, [tab]);

  async function fetchFriendships() {
    const { data } = await supabase
      .from('friendships')
      .select('*, requester:requester_id(username, avatar_url), addressee:addressee_id(username, avatar_url)')
      .or(`requester_id.eq.${profile.id},addressee_id.eq.${profile.id}`);
    setFriendships(data || []);
  }

  async function sendFriendRequest() {
    const u = friendUsername.trim().toLowerCase();
    if (!u) return;
    setLoading(true); setMsg('');
    if (u === profile.username) { setMsg('That\'s you!'); setLoading(false); return; }
    const { data: target } = await supabase.from('profiles').select('id, username').eq('username', u).single();
    if (!target) { setMsg('User not found'); setLoading(false); return; }
    const { error } = await supabase.from('friendships').insert({ requester_id: profile.id, addressee_id: target.id });
    if (error) { setMsg(error.code === '23505' ? 'Request already sent' : error.message); }
    else { setMsg(`Request sent to ${target.username}!`); setFriendUsername(''); fetchFriendships(); }
    setLoading(false);
  }

  async function acceptRequest(id) {
    await supabase.from('friendships').update({ status: 'accepted' }).eq('id', id);
    fetchFriendships();
  }

  async function removeFriend(id) {
    await supabase.from('friendships').delete().eq('id', id);
    fetchFriendships();
  }

  async function fetchLeaderboard() {
    // Get all accepted friends
    const accepted = friendships.filter(f => f.status === 'accepted');
    const friendIds = accepted.map(f => f.requester_id === profile.id ? f.addressee_id : f.requester_id);
    const allIds = [profile.id, ...friendIds];

    const { data: consistencies } = await supabase.from('consistency').select('user_id, intensity').in('user_id', allIds);
    const { data: profiles } = await supabase.from('profiles').select('id, username, avatar_url').in('id', allIds);

    const totals = {};
    allIds.forEach(id => { totals[id] = 0; });
    (consistencies || []).forEach(c => { totals[c.user_id] = (totals[c.user_id] || 0) + c.intensity; });

    const rows = (profiles || []).map(p => ({
      ...p,
      diamonds: Math.min(800, Math.round(totals[p.id] * 10) / 10)
    })).sort((a,b) => b.diamonds - a.diamonds);

    setLeaderboard(rows);
  }

  async function fetchFriendGrids() {
    const accepted = friendships.filter(f => f.status === 'accepted');
    const friendIds = accepted.map(f => f.requester_id === profile.id ? f.addressee_id : f.requester_id);
    if (!friendIds.length) { setFriendGrids([]); return; }

    const { data: profiles } = await supabase.from('profiles').select('id, username').in('id', friendIds);
    const { data: consistencies } = await supabase.from('consistency').select('user_id, day_key, intensity, done_tasks, pending_tasks').in('user_id', friendIds);

    const grids = (profiles || []).map(p => {
      const entries = (consistencies || []).filter(c => c.user_id === p.id);
      const consistency = {};
      entries.forEach(c => {
        consistency[c.day_key] = { intensity: c.intensity, done: c.done_tasks || [], pending: c.pending_tasks || [] };
      });
      return { ...p, consistency };
    });
    setFriendGrids(grids);
  }

  const pending = friendships.filter(f => f.status === 'pending' && f.addressee_id === profile.id);
  const accepted = friendships.filter(f => f.status === 'accepted');
  const sent = friendships.filter(f => f.status === 'pending' && f.requester_id === profile.id);

  function getFriendProfile(f) {
    return f.requester_id === profile.id ? f.addressee : f.requester;
  }

  return (
    <div className="social-wrap">
      <div style={{ display:'flex', gap:'6px', marginBottom:'1.5rem' }}>
        {['friends','leaderboard','grids'].map(t => (
          <button key={t} className={'view-tab'+(tab===t?' active':'')} onClick={() => setTab(t)}>
            {t === 'friends' ? '👥 Friends' : t === 'leaderboard' ? '🏆 Leaderboard' : '📊 Compare Grids'}
          </button>
        ))}
      </div>

      {tab === 'friends' && (
        <>
          <div className="social-section">
            <div className="social-section-title">Add a friend</div>
            <div className="friend-input-row">
              <input
                className="friend-input"
                placeholder="Enter their username..."
                value={friendUsername}
                onChange={e => setFriendUsername(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendFriendRequest()}
              />
              <button className="friend-add-btn" onClick={sendFriendRequest} disabled={loading || !friendUsername.trim()}>
                Send request
              </button>
            </div>
            {msg && <div style={{ fontFamily:'var(--font-mono)', fontSize:'11px', color: msg.includes('sent') ? 'var(--accent)' : 'var(--danger)' }}>{msg}</div>}
          </div>

          {pending.length > 0 && (
            <div className="social-section">
              <div className="social-section-title">Incoming requests ({pending.length})</div>
              {pending.map(f => {
                const fp = getFriendProfile(f);
                return (
                  <div key={f.id} className="friend-row">
                    <div className="friend-avatar">{fp?.username?.[0]?.toUpperCase()}</div>
                    <div className="friend-name">{fp?.username}</div>
                    <button className="friend-action-btn accept" onClick={() => acceptRequest(f.id)}>Accept</button>
                    <button className="friend-action-btn remove" onClick={() => removeFriend(f.id)}>Decline</button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="social-section">
            <div className="social-section-title">Friends ({accepted.length})</div>
            {accepted.length === 0 && <div style={{ fontFamily:'var(--font-mono)', fontSize:'11px', color:'var(--muted)' }}>No friends yet — add someone above!</div>}
            {accepted.map(f => {
              const fp = getFriendProfile(f);
              return (
                <div key={f.id} className="friend-row">
                  <div className="friend-avatar">{fp?.username?.[0]?.toUpperCase()}</div>
                  <div className="friend-name">{fp?.username}</div>
                  <div className="friend-status">friend</div>
                  <button className="friend-action-btn remove" onClick={() => removeFriend(f.id)}>Remove</button>
                </div>
              );
            })}
          </div>

          {sent.length > 0 && (
            <div className="social-section">
              <div className="social-section-title">Sent requests</div>
              {sent.map(f => {
                const fp = getFriendProfile(f);
                return (
                  <div key={f.id} className="friend-row">
                    <div className="friend-avatar">{fp?.username?.[0]?.toUpperCase()}</div>
                    <div className="friend-name">{fp?.username}</div>
                    <div className="friend-status">pending</div>
                    <button className="friend-action-btn remove" onClick={() => removeFriend(f.id)}>Cancel</button>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {tab === 'leaderboard' && (
        <div className="social-section">
          <div className="social-section-title">Diamond rankings — you + friends</div>
          {leaderboard.length === 0 && <div style={{ fontFamily:'var(--font-mono)', fontSize:'11px', color:'var(--muted)' }}>Add friends to see the leaderboard</div>}
          {leaderboard.map((row, i) => {
            const rankCls = i===0?'gold':i===1?'silver':i===2?'bronze':'';
            const maxD = leaderboard[0]?.diamonds || 1;
            return (
              <div key={row.id} className="lb-row">
                <div className={'lb-rank '+rankCls}>#{i+1}</div>
                <div className="friend-avatar">{row.username[0].toUpperCase()}</div>
                <div className="lb-name">
                  {row.username}
                  {row.id === profile.id && <span className="lb-you">you</span>}
                </div>
                <div className="lb-bar-bg"><div className="lb-bar-fill" style={{ width: (row.diamonds/800*100)+'%' }} /></div>
                <div className="lb-diamonds">💎 {row.diamonds % 1 === 0 ? row.diamonds : row.diamonds.toFixed(1)}</div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'grids' && (
        <>
          {friendGrids.length === 0 && (
            <div className="social-section">
              <div style={{ fontFamily:'var(--font-mono)', fontSize:'11px', color:'var(--muted)' }}>
                {accepted.length === 0 ? 'Add friends to compare grids' : 'Loading friend grids...'}
              </div>
            </div>
          )}
          <div className="friend-grids">
            {friendGrids.map(fg => (
              <div key={fg.id}>
                <ConsistencyGrid consistency={fg.consistency} label={`${fg.username}'s consistency`} />
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
