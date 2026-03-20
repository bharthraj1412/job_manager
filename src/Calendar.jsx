// src/Calendar.jsx — Job Application Calendar View
// Shows deadlines, interviews, applied dates + custom events stored in Supabase

import { useState, useEffect, useMemo } from 'react';
import { supabase } from './supabase';

// ── Event type config ─────────────────────────────────────────────────────────
const EVENT_TYPES = {
  deadline:   { color: '#ef4444', bg: 'rgba(239,68,68,0.15)',    border: 'rgba(239,68,68,0.3)',    label: 'Deadline',   icon: '⏰' },
  interview:  { color: '#22c55e', bg: 'rgba(34,197,94,0.15)',    border: 'rgba(34,197,94,0.3)',    label: 'Interview',  icon: '🎙' },
  applied:    { color: '#60a5fa', bg: 'rgba(96,165,250,0.15)',   border: 'rgba(96,165,250,0.3)',   label: 'Applied',    icon: '✉️' },
  offer:      { color: '#fde047', bg: 'rgba(253,224,71,0.15)',   border: 'rgba(253,224,71,0.3)',   label: 'Offer',      icon: '🏆' },
  follow_up:  { color: '#a78bfa', bg: 'rgba(167,139,250,0.15)', border: 'rgba(167,139,250,0.3)', label: 'Follow Up',  icon: '📨' },
  reminder:   { color: '#06b6d4', bg: 'rgba(6,182,212,0.15)',   border: 'rgba(6,182,212,0.3)',   label: 'Reminder',   icon: '🔔' },
  other:      { color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', border: 'rgba(148,163,184,0.2)', label: 'Other',      icon: '📌' },
};

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_NAMES   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function toDateStr(d) {
  if (!d) return '';
  return String(d).slice(0, 10);
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

// ── Mini input helpers ────────────────────────────────────────────────────────
const MInp = ({ value, onChange, placeholder, type = 'text', sx = {} }) => (
  <input type={type} value={value} onChange={onChange} placeholder={placeholder}
    style={{ width: '100%', background: '#070f1c', border: '1px solid #1e2d45', borderRadius: 8, padding: '9px 12px', color: '#e2e8f0', fontSize: 13, outline: 'none', boxSizing: 'border-box', fontFamily: 'inherit', ...sx }}
    onFocus={e => (e.target.style.borderColor = '#4f46e5')}
    onBlur={e =>  (e.target.style.borderColor = '#1e2d45')} />
);

const MLbl = ({ children }) => (
  <div style={{ color: '#475569', fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: 6 }}>
    {children}
  </div>
);

// ── Main Component ────────────────────────────────────────────────────────────
export default function Calendar({ jobs, session, notify }) {
  const [currentDate,  setCurrentDate]  = useState(new Date());
  const [selectedDay,  setSelectedDay]  = useState(null);
  const [customEvents, setCustomEvents] = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [newEvent,     setNewEvent]     = useState({ title: '', event_date: '', event_time: '', type: 'reminder', notes: '' });
  const [view,         setView]         = useState('month'); // 'month' | 'agenda'

  const year  = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const today = todayStr();

  // ── Load custom events from Supabase ─────────────────────────────────────
  useEffect(() => { loadEvents(); }, [session]);

  async function loadEvents() {
    setLoading(true);
    const { data } = await supabase
      .from('calendar_events')
      .select('*')
      .order('event_date', { ascending: true });
    if (data) setCustomEvents(data);
    setLoading(false);
  }

  async function saveEvent() {
    if (!newEvent.title.trim() || !newEvent.event_date) return notify('Title and date are required', 'err');
    setSaving(true);
    const { error } = await supabase.from('calendar_events').insert([{
      user_id:    session.user.id,
      title:      newEvent.title.trim(),
      event_date: newEvent.event_date,
      event_time: newEvent.event_time || null,
      type:       newEvent.type,
      notes:      newEvent.notes.trim() || null,
      is_done:    false,
    }]);
    if (!error) {
      await loadEvents();
      notify('Event added ✓');
      setShowAddModal(false);
      setNewEvent({ title: '', event_date: '', event_time: '', type: 'reminder', notes: '' });
    } else {
      notify(error.message, 'err');
    }
    setSaving(false);
  }

  async function toggleDone(id, isDone) {
    const { error } = await supabase.from('calendar_events').update({ is_done: !isDone }).eq('id', id);
    if (!error) setCustomEvents(prev => prev.map(e => e.id === id ? { ...e, is_done: !isDone } : e));
  }

  async function deleteEvent(id) {
    if (!confirm('Delete this event?')) return;
    await supabase.from('calendar_events').delete().eq('id', id);
    setCustomEvents(prev => prev.filter(e => e.id !== id));
    if (selectedDay) setSelectedDay(prev => prev); // trigger re-render
    notify('Event deleted');
  }

  // ── Build events map from jobs + custom events ────────────────────────────
  const allEvents = useMemo(() => {
    const map = {}; // YYYY-MM-DD → array of events

    const add = (date, event) => {
      const key = toDateStr(date);
      if (!key) return;
      if (!map[key]) map[key] = [];
      map[key].push(event);
    };

    jobs.forEach(job => {
      // Deadline
      if (job.deadline) {
        const t = job.status === 'Interview' ? 'interview' : job.status === 'Offer' ? 'offer' : 'deadline';
        add(job.deadline, {
          id: `jd_${job.id}`, source: 'job', type: t,
          title: `${job.title} @ ${job.company}`,
          sub: job.status === 'Interview' ? 'Interview deadline' : job.status === 'Offer' ? 'Offer deadline' : 'Application deadline',
          job,
        });
      }
      // Applied date
      if (job.applieddate && job.status !== 'Bookmarked') {
        add(job.applieddate, {
          id: `ja_${job.id}`, source: 'job', type: 'applied',
          title: `Applied: ${job.title} @ ${job.company}`,
          job,
        });
      }
    });

    customEvents.forEach(ev => {
      add(ev.event_date, {
        id: `ce_${ev.id}`, source: 'custom', type: ev.type,
        title: ev.title,
        time:  ev.event_time,
        notes: ev.notes,
        is_done: ev.is_done,
        dbId:  ev.id,
      });
    });

    return map;
  }, [jobs, customEvents]);

  // ── Upcoming events (next 30 days) ────────────────────────────────────────
  const upcoming = useMemo(() => {
    const now  = new Date(); now.setHours(0, 0, 0, 0);
    const end  = new Date(now.getTime() + 30 * 86400000);
    const result = [];
    Object.entries(allEvents).forEach(([date, evs]) => {
      const d = new Date(date + 'T00:00:00');
      if (d >= now && d <= end) evs.forEach(ev => result.push({ ...ev, date }));
    });
    return result.sort((a, b) => a.date.localeCompare(b.date));
  }, [allEvents]);

  // ── Calendar grid helpers ─────────────────────────────────────────────────
  const daysInMonth     = new Date(year, month + 1, 0).getDate();
  const firstDayOfMonth = new Date(year, month, 1).getDay();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToday   = () => { setCurrentDate(new Date()); setSelectedDay(today); };

  const thisMonthCount = Object.entries(allEvents).reduce((sum, [date, evs]) => {
    const d = new Date(date + 'T00:00:00');
    return d.getFullYear() === year && d.getMonth() === month ? sum + evs.length : sum;
  }, 0);

  const selectedDayEvents = selectedDay ? (allEvents[selectedDay] || []) : [];

  const openAdd = (date) => {
    setNewEvent({ title: '', event_date: date || today, event_time: '', type: 'reminder', notes: '' });
    setShowAddModal(true);
  };

  // ── Agenda view data ──────────────────────────────────────────────────────
  const agendaDays = useMemo(() => {
    const result = [];
    const d = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0);
    while (d <= end) {
      const key = d.toISOString().slice(0, 10);
      if (allEvents[key]?.length) result.push({ date: key, events: allEvents[key] });
      d.setDate(d.getDate() + 1);
    }
    return result;
  }, [allEvents, year, month]);

  // ── Styles ────────────────────────────────────────────────────────────────
  const card = { background: '#06101e', border: '1px solid #1e2d45', borderRadius: 14, padding: 20 };

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
      <style>{`
        @keyframes mi { from { opacity:0; transform:translateY(10px) } to { opacity:1; transform:translateY(0) } }
        .cal-day { transition: all .12s; }
        .cal-day:hover { border-color: #2d4a6b !important; background: #07111f !important; }
        .cal-day.selected { border-color: #4f46e5 !important; background: rgba(79,70,229,0.15) !important; }
        .cal-day.is-today { border-color: rgba(79,70,229,0.5) !important; }
        .upcoming-item { transition: all .15s; }
        .upcoming-item:hover { border-color: var(--ev-color) !important; }
      `}</style>

      {/* ── Stat cards ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(138px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          ['This Month',    thisMonthCount,                                                '#60a5fa', '📅'],
          ['Next 30 Days',  upcoming.length,                                               '#67e8f9', '🔮'],
          ['Interviews',    jobs.filter(j => j.status === 'Interview').length,             '#22c55e', '🎙'],
          ['Deadlines Due', jobs.filter(j => j.deadline && j.deadline >= today && !['Rejected','Withdrawn','Offer'].includes(j.status)).length, '#f59e0b', '⏰'],
          ['Reminders',     customEvents.filter(e => !e.is_done).length,                  '#a78bfa', '🔔'],
        ].map(([label, val, color, icon]) => (
          <div key={label} style={{ ...card, textAlign: 'center', padding: '16px 12px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: color, opacity: 0.7 }} />
            <div style={{ fontSize: 18, marginBottom: 4 }}>{icon}</div>
            <div style={{ color, fontSize: 22, fontWeight: 800, fontFamily: "'JetBrains Mono', monospace", lineHeight: 1 }}>{val}</div>
            <div style={{ color: '#475569', fontSize: 10, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 296px', gap: 16, alignItems: 'start' }}>

        {/* ── Main calendar / agenda panel ── */}
        <div style={card}>
          {/* Controls row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={prevMonth}
                style={{ background: '#070f1c', border: '1px solid #1e2d45', color: '#94a3b8', borderRadius: 8, padding: '7px 13px', cursor: 'pointer', fontSize: 16, fontFamily: 'inherit', transition: 'all .15s' }}
                onMouseEnter={e => e.target.style.borderColor = '#4f46e5'}
                onMouseLeave={e => e.target.style.borderColor = '#1e2d45'}>‹</button>

              <div style={{ textAlign: 'center', minWidth: 180 }}>
                <div style={{ fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 800, color: '#f1f5f9' }}>
                  {MONTH_NAMES[month]} {year}
                </div>
              </div>

              <button onClick={nextMonth}
                style={{ background: '#070f1c', border: '1px solid #1e2d45', color: '#94a3b8', borderRadius: 8, padding: '7px 13px', cursor: 'pointer', fontSize: 16, fontFamily: 'inherit', transition: 'all .15s' }}
                onMouseEnter={e => e.target.style.borderColor = '#4f46e5'}
                onMouseLeave={e => e.target.style.borderColor = '#1e2d45'}>›</button>
            </div>

            <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
              <button onClick={goToday}
                style={{ background: 'rgba(79,70,229,0.12)', border: '1px solid rgba(79,70,229,0.3)', color: '#818cf8', borderRadius: 8, padding: '6px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 600, fontFamily: 'inherit' }}>
                Today
              </button>
              {/* View toggle */}
              <div style={{ display: 'flex', background: '#070f1c', border: '1px solid #1e2d45', borderRadius: 8, padding: 3 }}>
                {[['month','📅'],['agenda','📋']].map(([v, ic]) => (
                  <button key={v} onClick={() => setView(v)}
                    style={{ background: view === v ? '#1e2d45' : 'transparent', border: 'none', color: view === v ? '#e2e8f0' : '#475569', borderRadius: 6, padding: '5px 10px', cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' }}>
                    {ic}
                  </button>
                ))}
              </div>
              <button onClick={() => openAdd(selectedDay || today)}
                style={{ background: 'linear-gradient(135deg,#1d4ed8,#4f46e5)', border: 'none', color: '#fff', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 700, fontFamily: 'inherit' }}>
                ＋ Add Event
              </button>
            </div>
          </div>

          {/* ── MONTH VIEW ── */}
          {view === 'month' && <>
            {/* Day-name headers */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3, marginBottom: 4 }}>
              {DAY_NAMES.map(d => (
                <div key={d} style={{ textAlign: 'center', color: '#334155', fontSize: 10, fontWeight: 700, letterSpacing: '0.08em', padding: '4px 0' }}>{d}</div>
              ))}
            </div>

            {/* Day cells */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
              {/* Leading empty cells */}
              {Array.from({ length: firstDayOfMonth }).map((_, i) => (
                <div key={`e${i}`} style={{ height: 84, borderRadius: 8, background: 'transparent' }} />
              ))}

              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day    = i + 1;
                const ds     = `${year}-${String(month + 1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
                const isToday    = ds === today;
                const isSelected = ds === selectedDay;
                const isPast     = ds < today;
                const dayEvs     = allEvents[ds] || [];
                const hasDead    = dayEvs.some(e => e.type === 'deadline');
                const hasIntv    = dayEvs.some(e => e.type === 'interview');

                return (
                  <div key={day}
                    className={`cal-day${isSelected ? ' selected' : ''}${isToday ? ' is-today' : ''}`}
                    onClick={() => setSelectedDay(isSelected ? null : ds)}
                    style={{
                      height: 84,
                      background: isSelected ? 'rgba(79,70,229,0.15)' : isToday ? 'rgba(79,70,229,0.07)' : '#070f1c',
                      border: `1px solid ${isSelected ? '#4f46e5' : isToday ? 'rgba(79,70,229,0.45)' : '#1e2d45'}`,
                      borderRadius: 8, padding: '6px 7px', cursor: 'pointer', overflow: 'hidden',
                      position: 'relative',
                    }}>
                    {/* Day number */}
                    <div style={{
                      fontSize: 12, fontWeight: isToday ? 800 : 500, marginBottom: 4,
                      color: isToday ? '#818cf8' : isPast ? '#2d3f52' : '#94a3b8',
                      display: 'flex', alignItems: 'center', gap: 3,
                    }}>
                      {day}
                      {isToday && <span style={{ width: 5, height: 5, borderRadius: '50%', background: '#4f46e5', flexShrink: 0 }} />}
                    </div>

                    {/* Event chips (max 3) */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      {dayEvs.slice(0, 3).map((ev, ei) => {
                        const et = EVENT_TYPES[ev.type] || EVENT_TYPES.other;
                        return (
                          <div key={ei} style={{
                            background: et.bg,
                            borderLeft: `2px solid ${et.color}`,
                            color: et.color,
                            fontSize: 8, fontWeight: 600,
                            padding: '1px 4px', borderRadius: 3,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            textDecoration: ev.is_done ? 'line-through' : 'none',
                            opacity: ev.is_done ? 0.45 : 1,
                          }}>
                            {et.icon} {ev.title}
                          </div>
                        );
                      })}
                      {dayEvs.length > 3 && (
                        <div style={{ color: '#475569', fontSize: 8, paddingLeft: 4 }}>+{dayEvs.length - 3} more</div>
                      )}
                    </div>

                    {/* Urgency ring */}
                    {(hasDead || hasIntv) && !isPast && (
                      <div style={{
                        position: 'absolute', top: 4, right: 5, width: 6, height: 6,
                        borderRadius: '50%', background: hasIntv ? '#22c55e' : '#ef4444',
                      }} />
                    )}
                  </div>
                );
              })}
            </div>
          </>}

          {/* ── AGENDA VIEW ── */}
          {view === 'agenda' && (
            <div style={{ maxHeight: 520, overflowY: 'auto' }}>
              {agendaDays.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '48px 0', color: '#1e2d45' }}>
                  <div style={{ fontSize: 32, marginBottom: 8 }}>📭</div>
                  <div style={{ fontSize: 13, color: '#334155' }}>No events this month</div>
                </div>
              ) : agendaDays.map(({ date, events }) => {
                const d = new Date(date + 'T00:00:00');
                const isToday = date === today;
                const isPast  = date < today;
                return (
                  <div key={date} style={{ marginBottom: 16 }}>
                    <div style={{
                      color: isToday ? '#818cf8' : isPast ? '#334155' : '#94a3b8',
                      fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', marginBottom: 7,
                      display: 'flex', alignItems: 'center', gap: 8,
                    }}>
                      <span>{d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase()}</span>
                      {isToday && <span style={{ background: '#4f46e5', color: '#fff', padding: '1px 7px', borderRadius: 999, fontSize: 9, fontWeight: 700 }}>TODAY</span>}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 10, borderLeft: `2px solid ${isToday ? '#4f46e5' : '#1e2d45'}` }}>
                      {events.map((ev, i) => {
                        const et = EVENT_TYPES[ev.type] || EVENT_TYPES.other;
                        return (
                          <div key={i} style={{
                            background: et.bg, border: `1px solid ${et.border}`,
                            borderRadius: 8, padding: '9px 12px',
                            borderLeft: `3px solid ${et.color}`,
                            opacity: ev.is_done ? 0.5 : 1,
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                              <div>
                                <div style={{ color: et.color, fontSize: 10, fontWeight: 700, marginBottom: 2 }}>{et.icon} {et.label}{ev.time ? ` · ${ev.time}` : ''}</div>
                                <div style={{ color: '#e2e8f0', fontSize: 12, fontWeight: 600, textDecoration: ev.is_done ? 'line-through' : 'none' }}>{ev.title}</div>
                                {ev.notes && <div style={{ color: '#64748b', fontSize: 10, marginTop: 3 }}>{ev.notes}</div>}
                              </div>
                              {ev.source === 'custom' && (
                                <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                                  <button onClick={() => toggleDone(ev.dbId, ev.is_done)}
                                    style={{ background: ev.is_done ? 'rgba(34,197,94,0.12)' : 'transparent', border: `1px solid ${ev.is_done ? '#22c55e' : '#1e2d45'}`, color: ev.is_done ? '#22c55e' : '#475569', borderRadius: 5, padding: '2px 7px', cursor: 'pointer', fontSize: 11 }}>
                                    {ev.is_done ? '↩' : '✓'}
                                  </button>
                                  <button onClick={() => deleteEvent(ev.dbId)}
                                    style={{ background: 'rgba(220,38,38,0.07)', border: '1px solid #450a0a', color: '#f87171', borderRadius: 5, padding: '2px 7px', cursor: 'pointer', fontSize: 11 }}>
                                    ✕
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* ── Legend ── */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginTop: 18, paddingTop: 14, borderTop: '1px solid #1e2d45' }}>
            {Object.entries(EVENT_TYPES).map(([key, et]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: et.color, flexShrink: 0 }} />
                <span style={{ color: '#475569', fontSize: 10 }}>{et.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right sidebar ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Selected day panel */}
          {selectedDay ? (
            <div style={{ ...card, animation: 'mi .15s ease' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ color: '#94a3b8', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                  {new Date(selectedDay + 'T00:00:00').toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
                </div>
                <button onClick={() => openAdd(selectedDay)}
                  style={{ background: 'linear-gradient(135deg,#1d4ed8,#4f46e5)', border: 'none', color: '#fff', borderRadius: 7, padding: '5px 10px', cursor: 'pointer', fontSize: 11, fontWeight: 700, fontFamily: 'inherit' }}>
                  ＋ Event
                </button>
              </div>

              {selectedDayEvents.length === 0 ? (
                <div style={{ color: '#1e2d45', fontSize: 12, textAlign: 'center', padding: '20px 0', border: '1px dashed #1e2d45', borderRadius: 8 }}>
                  No events — click ＋ to add one
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {selectedDayEvents.map((ev, i) => {
                    const et = EVENT_TYPES[ev.type] || EVENT_TYPES.other;
                    return (
                      <div key={i} style={{
                        background: et.bg, border: `1px solid ${et.border}`,
                        borderRadius: 9, padding: '10px 12px', borderLeft: `3px solid ${et.color}`,
                        opacity: ev.is_done ? 0.55 : 1,
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ color: et.color, fontSize: 10, fontWeight: 700, marginBottom: 3 }}>{et.icon} {et.label}</div>
                            <div style={{ color: '#e2e8f0', fontSize: 12, fontWeight: 600, lineHeight: 1.4, textDecoration: ev.is_done ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {ev.title}
                            </div>
                            {ev.time  && <div style={{ color: '#64748b', fontSize: 10, marginTop: 2 }}>🕐 {ev.time}</div>}
                            {ev.notes && <div style={{ color: '#64748b', fontSize: 10, marginTop: 3, lineHeight: 1.5 }}>{ev.notes}</div>}
                            {ev.job?.applylink && (
                              <a href={ev.job.applylink} target="_blank" rel="noreferrer"
                                style={{ color: et.color, fontSize: 10, marginTop: 4, display: 'inline-block', textDecoration: 'none', fontWeight: 600 }}>
                                Apply ↗
                              </a>
                            )}
                          </div>
                          {ev.source === 'custom' && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flexShrink: 0 }}>
                              <button onClick={() => toggleDone(ev.dbId, ev.is_done)}
                                style={{ background: ev.is_done ? 'rgba(34,197,94,0.12)' : 'transparent', border: `1px solid ${ev.is_done ? '#22c55e' : '#1e2d45'}`, color: ev.is_done ? '#22c55e' : '#475569', borderRadius: 5, padding: '3px 7px', cursor: 'pointer', fontSize: 11 }}>
                                {ev.is_done ? '↩' : '✓'}
                              </button>
                              <button onClick={() => deleteEvent(ev.dbId)}
                                style={{ background: 'rgba(220,38,38,0.07)', border: '1px solid #450a0a', color: '#f87171', borderRadius: 5, padding: '3px 7px', cursor: 'pointer', fontSize: 11 }}>
                                ✕
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div style={{ ...card, textAlign: 'center', padding: '24px 16px', color: '#1e2d45' }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>👆</div>
              <div style={{ fontSize: 12, color: '#334155' }}>Click any day to see its events</div>
            </div>
          )}

          {/* Upcoming 30-day list */}
          <div style={{ ...card, flex: 1 }}>
            <div style={{ color: '#67e8f9', fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 12 }}>
              🔮 Next 30 Days
            </div>
            {loading ? (
              <div style={{ textAlign: 'center', padding: '20px 0', color: '#334155', fontSize: 12 }}>Loading…</div>
            ) : upcoming.length === 0 ? (
              <div style={{ color: '#1e2d45', fontSize: 12, textAlign: 'center', padding: '20px 0' }}>No upcoming events</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 380, overflowY: 'auto', paddingRight: 2 }}>
                {upcoming.map((ev, i) => {
                  const et = EVENT_TYPES[ev.type] || EVENT_TYPES.other;
                  const d  = new Date(ev.date + 'T00:00:00');
                  const daysAway = Math.ceil((d - new Date()) / 86400000);
                  return (
                    <div key={i}
                      className="upcoming-item"
                      onClick={() => { setSelectedDay(ev.date); setCurrentDate(new Date(ev.date + 'T00:00:00')); setView('month'); }}
                      style={{
                        '--ev-color': et.color,
                        background: '#070f1c', border: '1px solid #1e2d45',
                        borderRadius: 8, padding: '8px 10px', cursor: 'pointer',
                        borderLeft: `3px solid ${et.color}`,
                        opacity: ev.is_done ? 0.45 : 1,
                      }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{
                            color: '#e2e8f0', fontSize: 11, fontWeight: 600,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                            textDecoration: ev.is_done ? 'line-through' : 'none',
                          }}>
                            {et.icon} {ev.title}
                          </div>
                          <div style={{ color: '#475569', fontSize: 9, marginTop: 2 }}>
                            {d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                            {ev.time ? ` · ${ev.time}` : ''}
                          </div>
                        </div>
                        <span style={{
                          background: daysAway <= 2 ? 'rgba(239,68,68,0.12)' : daysAway <= 5 ? 'rgba(245,158,11,0.12)' : et.bg,
                          color: daysAway <= 2 ? '#f87171' : daysAway <= 5 ? '#fbbf24' : et.color,
                          border: `1px solid ${daysAway <= 2 ? 'rgba(239,68,68,0.3)' : daysAway <= 5 ? 'rgba(245,158,11,0.3)' : et.border}`,
                          padding: '2px 7px', borderRadius: 999, fontSize: 9, fontWeight: 700, flexShrink: 0,
                        }}>
                          {daysAway === 0 ? 'Today' : daysAway === 1 ? 'Tmrw' : `${daysAway}d`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Add Event Modal ── */}
      {showAddModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.88)', zIndex: 950, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}
          onClick={() => setShowAddModal(false)}>
          <div style={{ background: '#06101e', border: '1px solid #1e2d45', borderRadius: 18, width: '100%', maxWidth: 440, padding: 28, animation: 'mi .18s ease', boxShadow: '0 24px 80px rgba(0,0,0,0.6)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 22, paddingBottom: 16, borderBottom: '1px solid #0f1c2e' }}>
              <h2 style={{ color: '#f1f5f9', fontFamily: "'Syne', sans-serif", fontSize: 17, margin: 0, fontWeight: 800 }}>
                ＋ Add Calendar Event
              </h2>
              <button onClick={() => setShowAddModal(false)}
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid #1e2d45', color: '#64748b', width: 32, height: 32, borderRadius: 8, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15 }}>✕</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <MLbl>Title *</MLbl>
                <MInp value={newEvent.title} onChange={e => setNewEvent(p => ({ ...p, title: e.target.value }))} placeholder="e.g. Phone screening with HR" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <MLbl>Date *</MLbl>
                  <MInp type="date" value={newEvent.event_date} onChange={e => setNewEvent(p => ({ ...p, event_date: e.target.value }))} />
                </div>
                <div>
                  <MLbl>Time</MLbl>
                  <MInp type="time" value={newEvent.event_time} onChange={e => setNewEvent(p => ({ ...p, event_time: e.target.value }))} />
                </div>
              </div>

              <div>
                <MLbl>Type</MLbl>
                <select value={newEvent.type} onChange={e => setNewEvent(p => ({ ...p, type: e.target.value }))}
                  style={{ width: '100%', background: '#070f1c', border: '1px solid #1e2d45', borderRadius: 8, padding: '9px 12px', color: '#e2e8f0', fontSize: 13, outline: 'none', fontFamily: 'inherit', cursor: 'pointer' }}>
                  {Object.entries(EVENT_TYPES).map(([key, et]) => (
                    <option key={key} value={key}>{et.icon} {et.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <MLbl>Notes</MLbl>
                <textarea value={newEvent.notes} onChange={e => setNewEvent(p => ({ ...p, notes: e.target.value }))} rows={2}
                  placeholder="Optional notes…"
                  style={{ width: '100%', background: '#070f1c', border: '1px solid #1e2d45', borderRadius: 8, padding: '9px 12px', color: '#e2e8f0', fontSize: 13, outline: 'none', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }} />
              </div>

              {/* Type preview badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: EVENT_TYPES[newEvent.type]?.bg, border: `1px solid ${EVENT_TYPES[newEvent.type]?.border}`, borderRadius: 8 }}>
                <span style={{ fontSize: 16 }}>{EVENT_TYPES[newEvent.type]?.icon}</span>
                <span style={{ color: EVENT_TYPES[newEvent.type]?.color, fontSize: 12, fontWeight: 600 }}>
                  {EVENT_TYPES[newEvent.type]?.label}
                  {newEvent.event_date && ` · ${new Date(newEvent.event_date + 'T00:00:00').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`}
                  {newEvent.event_time && ` at ${newEvent.event_time}`}
                </span>
              </div>

              <button onClick={saveEvent} disabled={saving || !newEvent.title.trim() || !newEvent.event_date}
                style={{
                  background: saving || !newEvent.title.trim() || !newEvent.event_date ? '#1e2d45' : 'linear-gradient(135deg,#1d4ed8,#4f46e5)',
                  border: 'none', color: '#fff', borderRadius: 10, padding: '12px',
                  cursor: saving || !newEvent.title.trim() || !newEvent.event_date ? 'not-allowed' : 'pointer',
                  fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                  opacity: saving ? 0.7 : 1, marginTop: 2,
                }}>
                {saving ? 'Saving…' : '✓ Add Event'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
