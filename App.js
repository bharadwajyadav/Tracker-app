import React, { useState, useEffect } from 'react';
import './index.css';
import { supabase } from './lib/supabase';
import AuthScreen from './components/AuthScreen';
import UsernameSetup from './components/UsernameSetup';
import TrackerApp from './components/TrackerApp';

export default function App() {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else setLoading(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchProfile(session.user.id);
      else { setProfile(null); setLoading(false); }
    });
    return () => subscription.unsubscribe();
  }, []);

  async function fetchProfile(userId) {
    setLoading(true);
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
    setProfile(data || null);
    setLoading(false);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
  }

  if (loading) return (
    <div className="loading-screen">
      <div className="loading-dot">loading...</div>
    </div>
  );

  if (!session) return <AuthScreen />;
  if (!profile) return <UsernameSetup session={session} onComplete={p => setProfile(p)} />;
  return <TrackerApp session={session} profile={profile} onSignOut={handleSignOut} onProfileUpdate={setProfile} />;
}
