import React, { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import ConsistencyGrid from './ConsistencyGrid';
import Timeline from './Timeline';
import CalendarModal from './CalendarModal';
import SocialView from './SocialView';

const TL_N = 24;

function getDayKey(date) {
  const d = new Date(date);
  if (d.getHours() < 5) d.setDate(d.getDate() - 1);
  d.setHours(5,0,0,0);
  return d.toDateString();
}

function getMonthKey() {
  const n = new Date();
  return n.getFullYear() + '-' + String(n.getMonth()+1).padStart(2,'0');
}

function getCurrentWeek() {
  const d = new Date().getDate();
  if (d<=7) return 0; if (d<=14) return 1; if (d<=21) return 2; return 3;
}

function getWeekLabel(w) {
  const now = new Date(), y = now.getFullYear(), m = now.getMonth();
  const starts=[1,8,15,22], ends=[7,14,21,new Date(y,m+1,0).getDate()];
  const ms = now.toLocaleDateString('en-IN',{month:'short'});
  return `${ms} ${starts[w]}–${ends[w]}`;
}

function badgeClass(dl, done) {
  if (done) return 'badge-done';
  const diff = (new Date(dl) - new Date()) / 86400000;
  if (diff < 0) return 'badge-overdue';
  if (diff < 120) return 'badge-soon';
  return 'badge-future';
}

function fmtDeadline(dl) {
  return new Date(dl + 'T00:00:00').toLocaleDateString('en-IN', { month:'short', year:'numeric' });
}

function uid() { return 'id_' + Math.random().toString(36).substr(2,9); }

export default function TrackerApp({ session, profile, onSignOut, onProfileUpdate }) {
  const [view, setView] = useState('tracker'); // tracker | social
  const [clock, setClock] = useState('');
  const [clockDate, setClockDate] = useState('');
  const [clockDay, setClockDay] = useState('');

  // Timeline
  const [tlTasks, setTlTasksState] = useState([]);
  const [focusHrs, setFocusHrs] = useState(0);

  // Consistency
  const [consistency, setConsistency] = useState({});
  const [diamonds, setDiamonds] = useState(0);

  // Sections / Goals
  const [sections, setSections] = useState([]);

  // Month tasks
  const [monthTasks, setMonthTasks] = useState([[],[],[],[]]);
  const [activeWeek, setActiveWeek] = useState(getCurrentWeek());
  const [monthInput, setMonthInput] = useState('');

  // Calendar modal
  const [cal, setCal] = useState(null); // { title, current, onConfirm }

  // Edit states
  const [editingSection, setEditingSection] = useState(null);
  const [editingGoal, setEditingGoal] = useState(null);

  const dayKey = getDayKey(new Date());
  const syncTimeout = useRef(null);

  // ── CLOCK ──
  useEffect(() => {
    function tick() {
      const now = new Date();
      setClockDate(now.toLocaleDateString('en-IN',{day:'numeric',month:'long',year:'numeric'}));
      setClockDay(now.toLocaleDateString('en-IN',{weekday:'long'}));
      let h = now.getHours(); const ampm = h>=12?'PM':'AM'; h = h%12||12;
      setClock(h+':'+String(now.getMinutes()).padStart(2,'0')+':'+String(now.getSeconds()).padStart(2,'0')+' '+ampm);
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  // ── LOAD DATA ──
  useEffect(() => {
    loadAll();
  }, [profile.id]);

  async function loadAll() {
    await Promise.all([loadTimeline(), loadConsistency(), loadSections(), loadMonthTasks()]);
  }

  async function loadTimeline() {
    const { data } = await supabase.from('timeline_tasks').select('*').eq('user_id', profile.id).eq('day_key', dayKey);
    const tasks = (data || []).map(r => ({ id: r.task_id, startFrac: r.start_frac, endFrac: r.end_frac, text: r.text, done: r.done }));
    setTlTasksState(tasks);
    updateFocusHrs(tasks);
  }

  async function loadConsistency() {
    const { data } = await supabase.from('consistency').select('*').eq('user_id', profile.id);
    const c = {};
    (data || []).forEach(r => {
      c[r.day_key] = { intensity: r.intensity, done: r.done_tasks || [], pending: r.pending_tasks || [] };
    });
    setConsistency(c);
    updateDiamonds(c);
  }

  async function loadSections() {
    const { data: secs } = await supabase.from('sections').select('*').eq('user_id', profile.id).order('sort_order');
    if (!secs || secs.length === 0) { setSections([]); return; }
    const { data: goals } = await supabase.from('goals').select('*').in('section_id', secs.map(s => s.id)).order('sort_order');
    const sections = secs.map(s => ({
      ...s,
      goals: (goals || []).filter(g => g.section_id === s.id)
    }));
    setSections(sections);
  }

  async function loadMonthTasks() {
    const mk = getMonthKey();
    const { data } = await supabase.from('month_tasks').select('*').eq('user_id', profile.id).eq('month_key', mk).order('created_at');
    const arr = [[],[],[],[]];
    (data || []).forEach(t => { if (arr[t.week_index]) arr[t.week_index].push(t); });
    setMonthTasks(arr);
  }

  // ── TIMELINE ──
  function updateFocusHrs(tasks) {
    const total = tasks.filter(t => t.done).reduce((sum,t) => sum + (t.endFrac-t.startFrac)*TL_N, 0);
    setFocusHrs(total);
  }

  function updateDiamonds(c) {
    let d = 0;
    Object.values(c).forEach(e => { d += typeof e === 'object' ? (e.intensity||0) : 0; });
    setDiamonds(Math.max(0, Math.min(800, Math.round(d*10)/10)));
  }

  async function syncConsistency(tasks) {
    let doneHrs=0, totalHrs=0;
    tasks.forEach(t => {
      const hrs = (t.endFrac-t.startFrac)*TL_N;
      totalHrs += hrs;
      if (t.done) doneHrs += hrs;
    });
    const intensity = totalHrs > 0 ? doneHrs/totalHrs : 0;
    const done = tasks.filter(t=>t.done).map(t=>t.text||'(unnamed)');
    const pending = tasks.filter(t=>!t.done).map(t=>t.text||'(unnamed)');

    await supabase.from('consistency').upsert({
      user_id: profile.id, day_key: dayKey, intensity, done_tasks: done, pending_tasks: pending, updated_at: new Date().toISOString()
    }, { onConflict: 'user_id,day_key' });

    const newC = { ...consistency, [dayKey]: { intensity, done, pending } };
    setConsistency(newC);
    updateDiamonds(newC);
  }

  async function setTlTasks(tasks) {
    setTlTasksState(tasks);
    updateFocusHrs(tasks);

    // Debounce DB sync
    if (syncTimeout.current) clearTimeout(syncTimeout.current);
    syncTimeout.current = setTimeout(async () => {
      // Upsert all tasks
      if (tasks.length > 0) {
        await supabase.from('timeline_tasks').upsert(
          tasks.map(t => ({ user_id: profile.id, day_key: dayKey, task_id: t.id, start_frac: t.startFrac, end_frac: t.endFrac, text: t.text, done: t.done, updated_at: new Date().toISOString() })),
          { onConflict: 'user_id,day_key,task_id' }
        );
      }
      // Delete removed tasks
      const { data: existing } = await supabase.from('timeline_tasks').select('task_id').eq('user_id', profile.id).eq('day_key', dayKey);
      const existingIds = (existing||[]).map(r=>r.task_id);
      const currentIds = tasks.map(t=>t.id);
      const toDelete = existingIds.filter(id => !currentIds.includes(id));
      if (toDelete.length > 0) {
        await supabase.from('timeline_tasks').delete().eq('user_id', profile.id).eq('day_key', dayKey).in('task_id', toDelete);
      }
      syncConsistency(tasks);
    }, 800);
  }

  // ── SECTIONS / GOALS ──
  async function addSection() {
    const { data } = await supabase.from('sections').insert({ user_id: profile.id, title: 'New section', sort_order: sections.length }).select().single();
    if (data) { setSections([...sections, { ...data, goals: [] }]); setTimeout(() => setEditingSection(data.id), 50); }
  }

  async function updateSectionTitle(id, title) {
    await supabase.from('sections').update({ title }).eq('id', id);
    setSections(sections.map(s => s.id===id ? {...s,title} : s));
    setEditingSection(null);
  }

  async function deleteSection(id) {
    if (!window.confirm('Remove this section and all its goals?')) return;
    await supabase.from('sections').delete().eq('id', id);
    setSections(sections.filter(s => s.id!==id));
  }

  async function toggleSectionPublic(id, currentVal) {
    await supabase.from('sections').update({ is_public: !currentVal }).eq('id', id);
    setSections(sections.map(s => s.id===id ? {...s,is_public:!currentVal} : s));
  }

  async function addGoal(sectionId) {
    const sec = sections.find(s => s.id===sectionId);
    const todayStr = new Date().toISOString().slice(0,10);
    const { data } = await supabase.from('goals').insert({ section_id: sectionId, user_id: profile.id, text: 'New goal', start_date: todayStr, deadline: '2027-12-31', done: false, sort_order: (sec?.goals?.length||0) }).select().single();
    if (data) {
      setSections(sections.map(s => s.id===sectionId ? {...s, goals:[...s.goals, data]} : s));
      setTimeout(() => setEditingGoal(data.id), 50);
    }
  }

  async function updateGoalText(id, text) {
    await supabase.from('goals').update({ text }).eq('id', id);
    setSections(sections.map(s => ({ ...s, goals: s.goals.map(g => g.id===id ? {...g,text} : g) })));
    setEditingGoal(null);
  }

  async function toggleGoal(id, done) {
    await supabase.from('goals').update({ done: !done }).eq('id', id);
    setSections(sections.map(s => ({ ...s, goals: s.goals.map(g => g.id===id ? {...g,done:!done} : g) })));
  }

  async function updateGoalDate(id, field, val) {
    await supabase.from('goals').update({ [field]: val }).eq('id', id);
    setSections(sections.map(s => ({ ...s, goals: s.goals.map(g => g.id===id ? {...g,[field]:val} : g) })));
  }

  async function deleteGoal(id) {
    await supabase.from('goals').delete().eq('id', id);
    setSections(sections.map(s => ({ ...s, goals: s.goals.filter(g => g.id!==id) })));
  }

  // ── MONTH TASKS ──
  async function addMonthTask() {
    const text = monthInput.trim(); if (!text) return;
    const mk = getMonthKey();
    const { data } = await supabase.from('month_tasks').insert({ user_id: profile.id, month_key: mk, week_index: activeWeek, text, done: false }).select().single();
    if (data) {
      const arr = monthTasks.map((w,i) => i===activeWeek ? [...w, data] : w);
      setMonthTasks(arr);
      setMonthInput('');
    }
  }

  async function toggleMonthTask(id, done) {
    await supabase.from('month_tasks').update({ done: !done }).eq('id', id);
    setMonthTasks(monthTasks.map(w => w.map(t => t.id===id ? {...t,done:!done} : t)));
  }

  async function deleteMonthTask(id) {
    await supabase.from('month_tasks').delete().eq('id', id);
    setMonthTasks(monthTasks.map(w => w.filter(t => t.id!==id)));
  }

  const diamondPct = Math.max(0, (diamonds/800)*100);

  return (
    <div className="layout">
      {/* LEFT SIDEBAR */}
      <aside className="left">
        {/* User */}
        <div className="box">
          <div className="user-box">
            {profile.avatar_url
              ? <img className="user-avatar" src={profile.avatar_url} alt="" />
              : <div className="user-avatar-placeholder">{profile.username[0].toUpperCase()}</div>
            }
            <div className="user-name">@{profile.username}</div>
            <button className="signout-btn" onClick={onSignOut}>sign out</button>
          </div>
        </div>

        {/* Clock */}
        <div className="box">
          <div className="clock-date">{clockDate}</div>
          <div className="clock-day">{clockDay}</div>
          <div className="clock-time">{clock}</div>
        </div>

        {/* Focus hrs */}
        <div className="box">
          <div className="box-label">Focus hrs</div>
          <div className="stat-val">{focusHrs.toFixed(1)}</div>
          <div className="stat-sub">from completed sessions</div>
        </div>

        {/* Monthly tasks */}
        <div className="box month-box">
          <div className="box-label">Monthly tasks</div>
          <div className="month-tabs">
            {[0,1,2,3].map(w => (
              <button key={w} className={'week-tab'+(activeWeek===w?' active':'')} onClick={() => setActiveWeek(w)}>
                {getWeekLabel(w)}
              </button>
            ))}
          </div>
          <div className="month-input-row">
            <input className="todo-input" placeholder="Add task..." value={monthInput} onChange={e => setMonthInput(e.target.value)} onKeyDown={e => e.key==='Enter' && addMonthTask()} />
            <button className="todo-add-btn" onClick={addMonthTask}>+</button>
          </div>
          <div className="month-scroll">
            {(monthTasks[activeWeek]||[]).map(task => (
              <div key={task.id} className="month-item">
                <div className={'month-cb'+(task.done?' done':'')} onClick={() => toggleMonthTask(task.id, task.done)} />
                <div className={'month-item-text'+(task.done?' done':'')} onClick={() => toggleMonthTask(task.id, task.done)}>{task.text}</div>
                <div className="month-del" onClick={() => deleteMonthTask(task.id)}>×</div>
              </div>
            ))}
          </div>
        </div>
      </aside>

      {/* RIGHT MAIN */}
      <main className="right">
        <div className="right-header">
          <div className="right-title">Tracker</div>
          <div className="view-tabs">
            <button className={'view-tab'+(view==='tracker'?' active':'')} onClick={() => setView('tracker')}>My Tracker</button>
            <button className={'view-tab'+(view==='social'?' active':'')} onClick={() => setView('social')}>👥 Social</button>
          </div>
          <div className="diamond-wrap">
            <span style={{fontSize:'14px'}}>💎</span>
            <div className="currency-bar-bg"><div className="currency-bar-fill-diamond" style={{width:diamondPct+'%'}} /></div>
            <div className="currency-count"><span className="diamond-val">{diamonds%1===0?diamonds:diamonds.toFixed(1)}</span> / 800</div>
          </div>
        </div>

        {view === 'tracker' && (
          <>
            <ConsistencyGrid consistency={consistency} />

            <Timeline tasks={tlTasks} onTasksChange={setTlTasks} />

            {/* Sections */}
            <div>
              {sections.map(sec => (
                <div key={sec.id} className="section">
                  <div className="section-head">
                    <div className="section-title-wrap">
                      {editingSection === sec.id
                        ? <input
                            className="section-title-input"
                            defaultValue={sec.title}
                            autoFocus
                            onBlur={e => updateSectionTitle(sec.id, e.target.value||sec.title)}
                            onKeyDown={e => { if(e.key==='Enter') e.target.blur(); if(e.key==='Escape'){setEditingSection(null);} }}
                          />
                        : <div className="section-title" onDoubleClick={() => setEditingSection(sec.id)}>{sec.title}</div>
                      }
                    </div>
                    <div className="section-actions">
                      <button className="sec-btn pub" onClick={() => toggleSectionPublic(sec.id, sec.is_public)} title={sec.is_public?'Make private':'Make public to friends'}>
                        {sec.is_public ? '🔓 public' : '🔒 private'}
                      </button>
                      <button className="sec-btn add" onClick={() => addGoal(sec.id)}>+ Goal</button>
                      <button className="sec-btn del" onClick={() => deleteSection(sec.id)}>Remove</button>
                    </div>
                  </div>
                  {sec.goals.map(goal => (
                    <div key={goal.id} className="goal-row">
                      <div className={'checkbox'+(goal.done?' checked':'')} onClick={() => toggleGoal(goal.id, goal.done)} />
                      {editingGoal === goal.id
                        ? <input
                            className="goal-text-input"
                            defaultValue={goal.text}
                            autoFocus
                            onBlur={e => updateGoalText(goal.id, e.target.value||goal.text)}
                            onKeyDown={e => { if(e.key==='Enter') e.target.blur(); if(e.key==='Escape') setEditingGoal(null); }}
                          />
                        : <div className={'goal-text'+(goal.done?' done':'')} onClick={() => toggleGoal(goal.id, goal.done)}>{goal.text}</div>
                      }
                      <span className="goal-edit-btn" onClick={() => setEditingGoal(goal.id)}>✎</span>
                      <div className="badge-range">
                        <div className="badge badge-start" onClick={() => setCal({ title:'Start date: '+goal.text, current:goal.start_date, onConfirm: v => updateGoalDate(goal.id,'start_date',v) })}>
                          {goal.start_date ? fmtDeadline(goal.start_date) : 'Set start'}
                        </div>
                        <span className="badge-arrow">→</span>
                        <div className={'badge '+badgeClass(goal.deadline,goal.done)} onClick={() => setCal({ title:'End date: '+goal.text, current:goal.deadline, onConfirm: v => updateGoalDate(goal.id,'deadline',v) })}>
                          {fmtDeadline(goal.deadline)}
                        </div>
                      </div>
                      <span className="goal-del-btn" onClick={() => deleteGoal(goal.id)}>×</span>
                    </div>
                  ))}
                </div>
              ))}
              <div className="add-section-btn" onClick={addSection}>+ Add Section</div>
            </div>
          </>
        )}

        {view === 'social' && <SocialView profile={profile} />}
      </main>

      {/* Calendar Modal */}
      {cal && <CalendarModal title={cal.title} current={cal.current} onConfirm={cal.onConfirm} onClose={() => setCal(null)} />}
    </div>
  );
}
