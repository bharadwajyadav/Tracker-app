import React, { useState } from 'react';

const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

export default function CalendarModal({ title, current, onConfirm, onClose }) {
  const today = new Date(); today.setHours(0,0,0,0);
  const init = current ? new Date(current + 'T00:00:00') : today;
  const [viewYear, setViewYear] = useState(init.getFullYear());
  const [viewMonth, setViewMonth] = useState(init.getMonth());
  const [selected, setSelected] = useState(current || null);

  function navMonth(dir) {
    let m = viewMonth + dir, y = viewYear;
    if (m > 11) { m = 0; y++; }
    if (m < 0) { m = 11; y--; }
    setViewMonth(m); setViewYear(y);
  }

  const firstDay = new Date(viewYear, viewMonth, 1).getDay();
  const dim = new Date(viewYear, viewMonth + 1, 0).getDate();
  const isCur = viewYear === today.getFullYear() && viewMonth === today.getMonth();

  const days = [];
  for (let i = 0; i < firstDay; i++) days.push(null);
  for (let d = 1; d <= dim; d++) days.push(d);

  function fmtDs(d) {
    return viewYear + '-' + String(viewMonth+1).padStart(2,'0') + '-' + String(d).padStart(2,'0');
  }

  return (
    <div className="cal-overlay" onClick={onClose}>
      <div className="cal-box" onClick={e => e.stopPropagation()}>
        <div className="cal-title">{title}</div>
        <div className="cal-header">
          <button className="cal-nav" onClick={() => navMonth(-1)} style={isCur?{opacity:0.3,pointerEvents:'none'}:{}}>‹</button>
          <div className="cal-month-year">{MONTHS[viewMonth]} {viewYear}</div>
          <button className="cal-nav" onClick={() => navMonth(1)}>›</button>
        </div>
        <div className="cal-dow-row">
          {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => <div key={d} className="cal-dow">{d}</div>)}
        </div>
        <div className="cal-days">
          {days.map((d, i) => {
            if (!d) return <div key={i} className="cal-day cal-empty" />;
            const ds = fmtDs(d);
            const cd = new Date(viewYear, viewMonth, d); cd.setHours(0,0,0,0);
            const isPast = cd < today && cd.getTime() !== today.getTime();
            const isToday = cd.getTime() === today.getTime();
            const isSel = ds === selected;
            let cls = 'cal-day';
            if (isPast) cls += ' cal-past';
            if (isToday) cls += ' cal-today';
            if (isSel) cls += ' cal-selected';
            return (
              <div key={i} className={cls} onClick={() => { if (!isPast) setSelected(ds); }}>{d}</div>
            );
          })}
        </div>
        <div className="cal-btns">
          <button className="cal-btn" onClick={onClose}>Cancel</button>
          <button className="cal-btn confirm" disabled={!selected} onClick={() => { if (selected) { onConfirm(selected); onClose(); } }}>Set</button>
        </div>
      </div>
    </div>
  );
}
