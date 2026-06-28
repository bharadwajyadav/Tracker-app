import React, { useState } from 'react';

function intensityToStyle(v) {
  if (v <= 0) return {};
  const alpha = 0.15 + v * 0.75;
  const glow = v > 0.8 ? `0 0 ${Math.round(v*6)}px rgba(210,230,255,${v*0.7})` : undefined;
  return { background: `rgba(210,225,255,${alpha.toFixed(2)})`, boxShadow: glow };
}

export default function ConsistencyGrid({ consistency, label }) {
  const [tooltip, setTooltip] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const today = new Date(); today.setHours(0,0,0,0);
  const start = new Date(today); start.setDate(today.getDate() - 364);
  const startDow = start.getDay(); start.setDate(start.getDate() - startDow);
  const totalDays = Math.ceil((today - start) / 86400000) + 1;
  const totalCols = Math.ceil(totalDays / 7);

  function getDayKey(date) {
    return date.toDateString();
  }

  const cols = [];
  for (let w = 0; w < totalCols; w++) {
    const cells = [];
    for (let d = 0; d < 7; d++) {
      const date = new Date(start); date.setDate(start.getDate() + w*7 + d); date.setHours(0,0,0,0);
      const ds = getDayKey(date);
      const isFuture = date > today;
      const isBefore = date < new Date(today.getTime() - 364*86400000);
      const isToday = ds === getDayKey(today);
      const entry = consistency[ds];
      let intensity = 0;
      if (entry) {
        intensity = typeof entry === 'object'
          ? (entry.intensity !== undefined ? entry.intensity : (entry.status === 'full' ? 1 : entry.status === 'half' ? 0.5 : 0))
          : 0;
      }
      const style = (!isFuture && !isBefore && entry) ? intensityToStyle(intensity) : {};
      if (isFuture || isBefore) style.opacity = 0.12;
      cells.push(
        <div
          key={d}
          className={'consist-cell' + (isToday ? ' today' : '')}
          style={style}
          onMouseEnter={e => {
            setTooltipPos({ x: e.clientX, y: e.clientY });
            setTooltip({ date, ds, entry, intensity });
          }}
          onMouseMove={e => setTooltipPos({ x: e.clientX, y: e.clientY })}
          onMouseLeave={() => setTooltip(null)}
        />
      );
    }
    cols.push(<div key={w} className="consist-col">{cells}</div>);
  }

  return (
    <div className="consist-wrap">
      <div className="consist-label">{label || 'Consistency — 365 days'}</div>
      <div className="consist-grid">{cols}</div>
      <div className="consist-legend">
        <span className="leg-box leg-empty" /><span className="leg-txt">None</span>
        <span className="leg-box leg-low" /><span className="leg-txt">Low</span>
        <span className="leg-box leg-mid" /><span className="leg-txt">Mid</span>
        <span className="leg-box leg-high" /><span className="leg-txt">Full</span>
      </div>
      {tooltip && (
        <div className="cell-tooltip" style={{
          left: Math.min(tooltipPos.x + 14, window.innerWidth - 240),
          top: Math.min(tooltipPos.y + 14, window.innerHeight - 120)
        }}>
          <div className="tooltip-date">{tooltip.date.toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric', weekday:'short' })}</div>
          {!tooltip.entry
            ? <div className="tooltip-empty">No data</div>
            : <>
                <div style={{ color:'var(--muted2)', fontSize:'9px' }}>Intensity: {(tooltip.intensity * 100).toFixed(0)}%</div>
                {(tooltip.entry.done || []).map((t,i) => <div key={i} className="tooltip-done">✓ {t}</div>)}
                {(tooltip.entry.pending || []).map((t,i) => <div key={i} className="tooltip-pending">✗ {t}</div>)}
              </>
          }
        </div>
      )}
    </div>
  );
}
