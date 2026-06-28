import React, { useRef, useState, useEffect, useCallback } from 'react';

const TL_HOURS = [5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,0,1,2,3,4];
const TL_N = 24;

function fmtHourShort(h) { const ampm = h>=12?'PM':'AM'; const h12 = h%12||12; return h12+ampm; }

function fracToTimeLabel(frac) {
  const totalMin = Math.round(frac * TL_N * 60);
  if (totalMin >= TL_N*60) { const h12 = TL_HOURS[0]%12||12; return `${h12}:00 ${TL_HOURS[0]>=12?'PM':'AM'}`; }
  const hourIdx = Math.floor(totalMin/60);
  const min = totalMin % 60;
  const realHour = TL_HOURS[hourIdx];
  const ampm = realHour>=12?'PM':'AM';
  const h12 = realHour%12||12;
  return `${h12}:${String(min).padStart(2,'0')} ${ampm}`;
}

function timeToFrac(hourIdx, minFrac=0) { return (hourIdx + minFrac) / TL_N; }

function uid() { return 'id_' + Math.random().toString(36).substr(2,9); }

function cbBracketSvg() {
  const r = 2.5;
  return `<svg width="16" height="16" viewBox="0 0 16 16">
    <path d="M 6.5 1.5 L ${1+r} 1.5 Q 1.5 1.5 1.5 ${1+r} L 1.5 ${15-r} Q 1.5 14.5 ${1+r} 14.5 L 6.5 14.5
             M 9.5 1.5 L ${15-r} 1.5 Q 14.5 1.5 14.5 ${1+r} L 14.5 ${15-r} Q 14.5 14.5 ${15-r} 14.5 L 9.5 14.5" />
  </svg>`;
}

export default function Timeline({ tasks, onTasksChange }) {
  const [pendingBegin, setPendingBegin] = useState(null);
  const [popover, setPopover] = useState(null); // { hourIdx, pos }
  const [specificHour, setSpecificHour] = useState(null);
  const [tooltip, setTooltip] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x:0, y:0 });
  const boxRefs = useRef({});
  const pathRefs = useRef({});
  const containerRef = useRef(null);

  const drawBrackets = useCallback(() => {
    tasks.forEach(task => {
      const box = boxRefs.current[task.id];
      const path = pathRefs.current[task.id];
      if (!box || !path) return;
      const w = box.clientWidth, h = box.clientHeight;
      if (!w||!h) return;
      const r = Math.min(5, w/2-1, h-2);
      const top=1, bottom=h-1, left=1, right=w-1;
      const d = `M ${left} ${bottom} L ${left} ${top+r} Q ${left} ${top} ${left+r} ${top} L ${right-r} ${top} Q ${right} ${top} ${right} ${top+r} L ${right} ${bottom}`;
      path.setAttribute('d', d);
      path.closest('svg').setAttribute('viewBox', `0 0 ${w} ${h}`);
      path.closest('svg').setAttribute('width', w);
      path.closest('svg').setAttribute('height', h);
    });
  }, [tasks]);

  useEffect(() => {
    requestAnimationFrame(drawBrackets);
  }, [tasks, drawBrackets]);

  useEffect(() => {
    function handleClickOutside(e) {
      if (popover && !e.target.closest('.tl-popover')) setPopover(null);
    }
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [popover]);

  function openPopover(hourIdx, e) {
    e.stopPropagation();
    setSpecificHour(null);
    setPopover({ hourIdx, pos: { x: e.clientX, y: e.clientY } });
  }

  function handleBegin(hourIdx, minFrac) {
    setPendingBegin({ hourIdx, minFrac });
    setPopover(null);
  }

  function handleEnd(hourIdx, minFrac) {
    if (!pendingBegin) { alert('Choose a Begin point first.'); return; }
    const startFrac = timeToFrac(pendingBegin.hourIdx, pendingBegin.minFrac);
    const endFrac = timeToFrac(hourIdx, minFrac);
    if (endFrac <= startFrac) { alert('End must be after Begin.'); return; }
    for (const t of tasks) {
      if (startFrac < t.endFrac && endFrac > t.startFrac) { alert('This slot overlaps an existing task.'); return; }
    }
    const newTask = { id: uid(), startFrac, endFrac, text: '', done: false };
    onTasksChange([...tasks, newTask]);
    setPendingBegin(null);
    setPopover(null);
  }

  function toggleTask(id) {
    onTasksChange(tasks.map(t => t.id === id ? { ...t, done: !t.done } : t));
  }

  function updateText(id, text) {
    onTasksChange(tasks.map(t => t.id === id ? { ...t, text } : t));
  }

  function deleteTask(id) {
    onTasksChange(tasks.filter(t => t.id !== id));
  }

  const isEndOfDay = popover && popover.hourIdx === TL_N;
  const isFirst = popover && popover.hourIdx === 0;

  return (
    <div className="timeline-wrap">
      <div className="timeline-label">Today's Timeline — 5:00 AM → 5:00 AM</div>
      <div className="timeline-inner" ref={containerRef}>
        {/* Hours row */}
        <div className="tl-hours-row">
          {TL_HOURS.map((h, i) => (
            <div key={i} className={'tl-hour-block' + (i===0?' edge-hour':'')} onClick={e => openPopover(i, e)}>
              <div className="tl-hour-label">{fmtHourShort(h)}</div>
            </div>
          ))}
          <div className="tl-hour-end-block" onClick={e => openPopover(TL_N, e)}>
            <div className="tl-hour-label">{fmtHourShort(TL_HOURS[0])}</div>
          </div>
        </div>

        {/* Rail */}
        <div className="tl-rail" />

        {/* Tasks */}
        <div className="tl-tasks">
          {pendingBegin && (
            <div className="tl-begin-marker" style={{ left: (timeToFrac(pendingBegin.hourIdx, pendingBegin.minFrac)*100)+'%' }} />
          )}
          {tasks.map(task => {
            const leftPct = (task.startFrac*100).toFixed(3)+'%';
            const widthPct = ((task.endFrac-task.startFrac)*100).toFixed(3)+'%';
            const startLabel = fracToTimeLabel(task.startFrac);
            const endLabel = fracToTimeLabel(task.endFrac);
            const durMin = Math.round((task.endFrac-task.startFrac)*TL_N*60);
            const durLabel = durMin>=60 ? `${(durMin/60).toFixed(durMin%60===0?0:1)}h` : `${durMin}m`;
            return (
              <div key={task.id} className={'tl-task-wrapper'+(task.done?' completed':'')} style={{ left:leftPct, width:widthPct }}>
                <div
                  className="tl-task-box"
                  ref={el => boxRefs.current[task.id] = el}
                  onMouseEnter={e => { setTooltipPos({x:e.clientX,y:e.clientY}); setTooltip({startLabel,endLabel,durLabel}); }}
                  onMouseMove={e => setTooltipPos({x:e.clientX,y:e.clientY})}
                  onMouseLeave={() => setTooltip(null)}
                >
                  <svg className="tl-task-bracket" style={{position:'absolute',top:0,left:0,width:'100%',height:'100%',pointerEvents:'none'}}>
                    <path ref={el => pathRefs.current[task.id] = el} fill="none" stroke={task.done?'var(--accent)':'var(--warn)'} strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  <input
                    className="tl-task-input"
                    value={task.text}
                    placeholder="Task…"
                    onChange={e => updateText(task.id, e.target.value)}
                    onClick={e => e.stopPropagation()}
                  />
                  <div className="tl-task-del" onClick={e => { e.stopPropagation(); deleteTask(task.id); }}>×</div>
                </div>
                <div
                  className={'tl-task-cb'+(task.done?' done':'')}
                  onClick={e => { e.stopPropagation(); toggleTask(task.id); }}
                  dangerouslySetInnerHTML={{ __html: cbBracketSvg() }}
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Popover */}
      {popover && (
        <div className="tl-popover" style={{ left: popover.pos.x, top: popover.pos.y - 10 }} onClick={e => e.stopPropagation()}>
          {!isEndOfDay && (
            <button className="tl-pop-btn begin" onClick={() => handleBegin(popover.hourIdx, 0)}>▶ Begin</button>
          )}
          {!isFirst && (
            <button className="tl-pop-btn end" onClick={() => handleEnd(popover.hourIdx, 0)}>■ End</button>
          )}
          {!isEndOfDay && (
            <button className="tl-pop-btn" onClick={() => setSpecificHour(popover.hourIdx)}>⊕ Specific</button>
          )}
          {specificHour !== null && (
            <div className="tl-zoom-row">
              {[15,30,45].map(min => (
                <button key={min} className="tl-zoom-min" onClick={e => {
                  e.stopPropagation();
                  const mf = min/60;
                  // Replace the main begin/end buttons with specific time ones
                  setPopover({ ...popover, specificMin: min });
                }}>:{String(min).padStart(2,'0')}</button>
              ))}
            </div>
          )}
          {popover.specificMin !== undefined && (
            <>
              <button className="tl-pop-btn begin" onClick={() => handleBegin(popover.hourIdx, popover.specificMin/60)}>
                ▶ Begin {fmtHourShort(TL_HOURS[popover.hourIdx])}:{String(popover.specificMin).padStart(2,'0')}
              </button>
              {!isFirst && (
                <button className="tl-pop-btn end" onClick={() => handleEnd(popover.hourIdx, popover.specificMin/60)}>
                  ■ End {fmtHourShort(TL_HOURS[popover.hourIdx])}:{String(popover.specificMin).padStart(2,'0')}
                </button>
              )}
            </>
          )}
        </div>
      )}

      {/* Tooltip */}
      {tooltip && (
        <div className="cell-tooltip" style={{
          position:'fixed', left: Math.min(tooltipPos.x+14, window.innerWidth-240), top: Math.min(tooltipPos.y+14, window.innerHeight-80)
        }}>
          <div className="tooltip-date">{tooltip.startLabel} – {tooltip.endLabel}</div>
          <div style={{color:'var(--muted2)',fontSize:'9px'}}>{tooltip.durLabel}</div>
        </div>
      )}
    </div>
  );
}
