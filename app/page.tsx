'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const supabase: SupabaseClient | null = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const HAC_URL = 'https://hac23.esp.k12.ar.us';
const HAC_CLASSWORK_URL = `${HAC_URL}/HomeAccess/Classes/Classwork`;
const BHS_AB_CALENDAR = 'https://bhs.bentonvillek12.org/parents/calendars/ab-day-calendar';
const HAC_LOCAL_KEY = 'homework-hub-hac-imports';

type Homework = {
  id: string;
  title: string;
  class_name: string;
  due_date: string;
  due_time: string | null;
  priority: 'low' | 'medium' | 'high';
  notes: string | null;
  completed: boolean;
  created_at: string;
  source?: 'hac';
  assigned_date?: string | null;
  category?: string | null;
  score?: string | null;
  total_points?: string | null;
};

type Course = { name: string; period: number | null; grade: string };

type HACAssignment = {
  id?: string;
  class_name: string;
  due_date: string;
  assigned_date?: string | null;
  title: string;
  category?: string | null;
  score?: string | null;
  total_points?: string | null;
};

const defaultCourses: Course[] = [
  { name: 'Wind Ensemble', period: 1, grade: '' },
  { name: 'Pre-AP Biology', period: 2, grade: '' },
  { name: 'Spanish 2', period: 3, grade: '' },
  { name: 'Pre-AP English I', period: 4, grade: '' },
  { name: 'Intro to Engineering', period: 5, grade: '' },
  { name: 'Advisory', period: 6, grade: '' },
  { name: 'AP CSP', period: 7, grade: '' },
  { name: 'AP Precalculus', period: 8, grade: '' },
];

function localDate(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toLocaleDateString('en-CA');
}

function dueLabel(item: Homework) {
  const today = localDate();
  const tomorrow = localDate(1);
  if (item.due_date === today) return 'Today';
  if (item.due_date === tomorrow) return 'Tomorrow';
  return new Date(`${item.due_date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

const fridayAnchors: Record<string, 'A' | 'B'> = {
  '2026-08-14': 'A', '2026-08-21': 'B', '2026-08-28': 'A', '2026-09-04': 'B', '2026-09-11': 'A',
  '2026-09-18': 'B', '2026-09-25': 'A', '2026-10-02': 'B', '2026-10-09': 'A', '2026-10-23': 'B',
  '2026-10-30': 'A', '2026-11-06': 'B', '2026-11-13': 'A', '2026-11-20': 'B', '2026-12-04': 'A',
  '2026-12-11': 'B', '2027-01-08': 'A', '2027-01-15': 'B', '2027-01-22': 'A', '2027-01-29': 'B',
  '2027-02-05': 'A', '2027-02-12': 'B', '2027-02-19': 'A', '2027-02-26': 'B', '2027-03-05': 'A',
  '2027-03-12': 'B', '2027-03-19': 'A', '2027-03-26': 'B', '2027-04-02': 'B', '2027-04-09': 'A',
  '2027-04-16': 'B', '2027-04-30': 'A', '2027-05-07': 'B', '2027-05-14': 'A',
};

function dayType(dateString: string): 'A' | 'B' | null {
  const d = new Date(`${dateString}T12:00:00`);
  const dow = d.getDay();
  if (dow === 0 || dow === 6) return null;
  if (dow === 1 || dow === 3) return 'A';
  if (dow === 2 || dow === 4) return 'B';
  return fridayAnchors[dateString] ?? null;
}

function courseDay(period: number | null): 'A' | 'B' | null {
  if (!period) return null;
  return period <= 4 ? 'A' : 'B';
}

function nextClassDate(period: number | null) {
  const target = courseDay(period);
  if (!target) return localDate();
  for (let i = 0; i < 21; i++) {
    const date = localDate(i);
    if (dayType(date) === target) return date;
  }
  return localDate();
}

function normalizeHacAssignment(raw: HACAssignment, index: number): Homework | null {
  if (!raw?.title || !raw?.class_name || !raw?.due_date) return null;
  const stable = `${raw.class_name}|${raw.title}|${raw.due_date}`.toLowerCase().replace(/\s+/g, ' ').trim();
  return {
    id: raw.id || `hac:${stable}`,
    title: raw.title.trim(),
    class_name: raw.class_name.trim(),
    due_date: raw.due_date,
    due_time: null,
    priority: 'medium',
    notes: raw.category ? `HAC category: ${raw.category}` : null,
    completed: false,
    created_at: raw.assigned_date || new Date(Date.now() + index).toISOString(),
    source: 'hac',
    assigned_date: raw.assigned_date || null,
    category: raw.category || null,
    score: raw.score || null,
    total_points: raw.total_points || null,
  };
}

export default function Home() {
  const [items, setItems] = useState<Homework[]>([]);
  const [courses, setCourses] = useState<Course[]>(defaultCourses);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [showSchedule, setShowSchedule] = useState(false);
  const [filter, setFilter] = useState<'upcoming' | 'completed'>('upcoming');
  const [error, setError] = useState('');
  const [hacStatus, setHacStatus] = useState('');
  const [form, setForm] = useState({ title: '', class_name: defaultCourses[0].name, due_date: localDate(), due_time: '', priority: 'medium' as Homework['priority'], notes: '' });

  useEffect(() => {
    try {
      const saved = localStorage.getItem('homework-hub-courses');
      if (saved) setCourses(JSON.parse(saved));
    } catch {}

    const receiveHac = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (!event.data || event.data.type !== 'HAC_CLASSWORK_IMPORT') return;
      const incoming = Array.isArray(event.data.assignments) ? event.data.assignments as HACAssignment[] : [];
      const normalized = incoming.map(normalizeHacAssignment).filter(Boolean) as Homework[];
      if (!normalized.length) {
        setHacStatus('HAC importer found no assignments. Open HAC Classwork and try again.');
        return;
      }
      try {
        const existingRaw = localStorage.getItem(HAC_LOCAL_KEY);
        const existing = existingRaw ? JSON.parse(existingRaw) as Homework[] : [];
        const merged = [...existing];
        const keys = new Set(existing.map(x => `${x.class_name}|${x.title}|${x.due_date}`.toLowerCase()));
        for (const item of normalized) {
          const key = `${item.class_name}|${item.title}|${item.due_date}`.toLowerCase();
          if (!keys.has(key)) { merged.push(item); keys.add(key); }
        }
        localStorage.setItem(HAC_LOCAL_KEY, JSON.stringify(merged));
        setItems(current => {
          const nonHac = current.filter(x => x.source !== 'hac');
          return [...nonHac, ...merged];
        });
        setHacStatus(`Imported ${normalized.length} assignment${normalized.length === 1 ? '' : 's'} from HAC.`);
      } catch {
        setHacStatus('HAC data was received, but could not be saved on this device.');
      }
    };
    window.addEventListener('message', receiveHac);
    return () => window.removeEventListener('message', receiveHac);
  }, []);

  function saveCourses(next: Course[]) {
    setCourses(next);
    localStorage.setItem('homework-hub-courses', JSON.stringify(next));
  }

  function selectClass(name: string) {
    const course = courses.find(c => c.name === name);
    setForm(f => ({ ...f, class_name: name, due_date: nextClassDate(course?.period ?? null) }));
  }

  async function load() {
    let remote: Homework[] = [];
    if (supabase) {
      const { data, error: queryError } = await supabase.from('homework').select('*').order('due_date').order('due_time');
      if (queryError) setError(queryError.message); else remote = (data ?? []) as Homework[];
    } else {
      setError('Supabase environment variables are missing.');
    }
    let localHac: Homework[] = [];
    try {
      const raw = localStorage.getItem(HAC_LOCAL_KEY);
      if (raw) localHac = JSON.parse(raw) as Homework[];
    } catch {}
    const seen = new Set<string>();
    const merged = [...remote, ...localHac].filter(item => {
      const key = `${item.source === 'hac' ? 'hac' : 'remote'}:${item.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    setItems(merged);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const visible = useMemo(() => items.filter(x => filter === 'completed' ? x.completed : !x.completed), [items, filter]);
  const todayCount = items.filter(x => !x.completed && x.due_date === localDate()).length;
  const overdueCount = items.filter(x => !x.completed && x.due_date < localDate()).length;

  async function addHomework(e: FormEvent) {
    e.preventDefault();
    if (!supabase || !form.title.trim()) return;
    setError('');
    const { error: insertError } = await supabase.from('homework').insert({ ...form, title: form.title.trim(), due_time: form.due_time || null, notes: form.notes.trim() || null });
    if (insertError) { setError(insertError.message); return; }
    setForm({ title: '', class_name: courses[0]?.name ?? '', due_date: nextClassDate(courses[0]?.period ?? null), due_time: '', priority: 'medium', notes: '' });
    setShowAdd(false);
    await load();
  }

  async function toggle(id: string, completed: boolean) {
    const item = items.find(x => x.id === id);
    if (item?.source === 'hac') {
      try {
        const raw = localStorage.getItem(HAC_LOCAL_KEY);
        const local = raw ? JSON.parse(raw) as Homework[] : [];
        const next = local.map(x => x.id === id ? { ...x, completed } : x);
        localStorage.setItem(HAC_LOCAL_KEY, JSON.stringify(next));
        setItems(old => old.map(x => x.id === id ? { ...x, completed } : x));
      } catch { setError('Could not save HAC assignment status.'); }
      return;
    }
    if (!supabase) return;
    const { error: updateError } = await supabase.from('homework').update({ completed }).eq('id', id);
    if (updateError) setError(updateError.message); else setItems(old => old.map(x => x.id === id ? { ...x, completed } : x));
  }

  async function remove(id: string) {
    const item = items.find(x => x.id === id);
    if (!confirm('Delete this assignment?')) return;
    if (item?.source === 'hac') {
      try {
        const raw = localStorage.getItem(HAC_LOCAL_KEY);
        const local = raw ? JSON.parse(raw) as Homework[] : [];
        localStorage.setItem(HAC_LOCAL_KEY, JSON.stringify(local.filter(x => x.id !== id)));
        setItems(old => old.filter(x => x.id !== id));
      } catch { setError('Could not delete HAC assignment.'); }
      return;
    }
    if (!supabase) return;
    const { error: deleteError } = await supabase.from('homework').delete().eq('id', id);
    if (deleteError) setError(deleteError.message); else setItems(old => old.filter(x => x.id !== id));
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div><p className="eyebrow">HOMEWORK HUB</p><h1>Stay on top of school.</h1></div>
        <div className="topActions">
          <button className="secondaryTop" onClick={() => setShowSchedule(true)}>Schedule</button>
          <a className="secondaryTop" href={HAC_CLASSWORK_URL} target="_blank" rel="noreferrer">HAC ↗</a>
          <a className="secondaryTop" href={HAC_CLASSWORK_URL} target="_blank" rel="noreferrer" onClick={() => setHacStatus('Open HAC Classwork, then return here. The browser importer will send the assignments back to Homework Hub.')}>Import HAC ↗</a>
          <button className="addTop" onClick={() => setShowAdd(true)}>＋ Add</button>
        </div>
      </header>

      {hacStatus && <div className="hacNotice">{hacStatus}</div>}

      <section className="stats">
        <div className="stat"><span>Due today</span><strong>{todayCount}</strong></div>
        <div className="stat"><span>Overdue</span><strong className={overdueCount ? 'danger' : ''}>{overdueCount}</strong></div>
        <div className="stat"><span>Remaining</span><strong>{items.filter(x => !x.completed).length}</strong></div>
      </section>

      <div className="sectionHead"><div><h2>{filter === 'upcoming' ? 'Upcoming' : 'Completed'}</h2><p>{filter === 'upcoming' ? 'Your next assignments, sorted by due date.' : 'Nice work. Here is what you finished.'}</p></div><div className="segmented"><button className={filter === 'upcoming' ? 'active' : ''} onClick={() => setFilter('upcoming')}>Upcoming</button><button className={filter === 'completed' ? 'active' : ''} onClick={() => setFilter('completed')}>Done</button></div></div>

      {error && <div className="error">{error}</div>}

      <section className="list">
        {loading ? <div className="empty">Loading your homework…</div> : visible.length === 0 ? <div className="empty"><div className="emptyIcon">✓</div><h3>{filter === 'upcoming' ? 'You’re all caught up!' : 'Nothing completed yet.'}</h3><p>{filter === 'upcoming' ? 'Add an assignment when your next one comes in.' : 'Finished assignments will show up here.'}</p></div> : visible.map(item => (
          <article className={`card priority-${item.priority}`} key={item.id}>
            <button className={`check ${item.completed ? 'checked' : ''}`} onClick={() => toggle(item.id, !item.completed)} aria-label="Mark complete">{item.completed ? '✓' : ''}</button>
            <div className="cardBody"><div className="cardTop"><span className="classTag">{item.class_name}</span><span className={`priority ${item.priority}`}>{item.priority}</span></div><h3>{item.title}</h3>{item.notes && <p className="notes">{item.notes}</p>}{item.source === 'hac' && item.score && <p className="notes">HAC score: {item.score}{item.total_points ? ` / ${item.total_points}` : ''}</p>}<div className="due">{dueLabel(item)}{item.due_time ? ` · ${new Date(`2000-01-01T${item.due_time}`).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ''}</div></div>
            <button className="delete" onClick={() => remove(item.id)} aria-label="Delete assignment">×</button>
          </article>
        ))}
      </section>

      <button className="floating" onClick={() => setShowAdd(true)}>＋</button>

      {showSchedule && <div className="modalBackdrop" onClick={() => setShowSchedule(false)}><div className="modal" onClick={e => e.stopPropagation()}><div className="modalHead"><div><p className="eyebrow">BHS SCHEDULE</p><h2>Your classes</h2></div><button className="close" onClick={() => setShowSchedule(false)}>×</button></div><p className="helper">Your periods are set to the BHS schedule shown in HAC. Homework Hub uses the period to automatically pick the next A/B day.</p>{courses.map((course, i) => <div className="scheduleRow" key={course.name}><div><strong>{course.name}</strong><span>{course.period ? `Period ${course.period} · ${courseDay(course.period)} Day` : 'Period not set'}</span></div><select value={course.period ?? ''} onChange={e => { const next = [...courses]; next[i] = { ...course, period: e.target.value ? Number(e.target.value) : null }; saveCourses(next); }}><option value="">Period</option>{[1,2,3,4,5,6,7,8].map(p => <option key={p} value={p}>Period {p}</option>)}</select></div>)}<div className="hints"><a href={HAC_CLASSWORK_URL} target="_blank" rel="noreferrer">Open HAC Classwork</a><a href={BHS_AB_CALENDAR} target="_blank" rel="noreferrer">BHS A/B calendar</a></div></div></div>}

      {showAdd && <div className="modalBackdrop" onClick={() => setShowAdd(false)}><form className="modal" onSubmit={addHomework} onClick={e => e.stopPropagation()}><div className="modalHead"><div><p className="eyebrow">NEW ASSIGNMENT</p><h2>Add homework</h2></div><button type="button" className="close" onClick={() => setShowAdd(false)}>×</button></div><label>Assignment<input autoFocus required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Chapter 4 practice" /></label><label>Class<select value={form.class_name} onChange={e => selectClass(e.target.value)}>{courses.map(c => <option key={c.name}>{c.name}</option>)}</select></label><div className="nextClass">{courseDay(courses.find(c => c.name === form.class_name)?.period ?? null) ? `Next ${courseDay(courses.find(c => c.name === form.class_name)?.period ?? null)} Day class: ${new Date(`${form.due_date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}` : 'Set this class period in Schedule to auto-pick its next A/B day.'}</div><div className="row"><label>Due date<input required type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} /></label><label>Time<input type="time" value={form.due_time} onChange={e => setForm({ ...form, due_time: e.target.value })} /></label></div><label>Priority<select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value as Homework['priority'] })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label><label>Notes <span>(optional)</span><textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Anything you need to remember…" /></label><button className="save" type="submit">Add assignment</button></form></div>}
    </main>
  );
}
