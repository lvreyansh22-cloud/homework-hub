'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!;
const supabase: SupabaseClient | null = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

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
};

const classes = ['Wind Ensemble', 'Pre-AP Biology', 'Spanish 2', 'Pre-AP English I', 'Intro to Engineering', 'AP CSP', 'AP Precalculus'];

function localDate(offset = 0) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  return d.toISOString().slice(0, 10);
}

function dueLabel(item: Homework) {
  const today = localDate();
  const tomorrow = localDate(1);
  if (item.due_date === today) return 'Today';
  if (item.due_date === tomorrow) return 'Tomorrow';
  return new Date(`${item.due_date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

export default function Home() {
  const [items, setItems] = useState<Homework[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [filter, setFilter] = useState<'upcoming' | 'completed'>('upcoming');
  const [error, setError] = useState('');
  const [form, setForm] = useState({ title: '', class_name: classes[0], due_date: localDate(), due_time: '', priority: 'medium' as Homework['priority'], notes: '' });

  async function load() {
    if (!supabase) { setLoading(false); setError('Supabase environment variables are missing.'); return; }
    setLoading(true);
    const { data, error: queryError } = await supabase.from('homework').select('*').order('due_date').order('due_time');
    if (queryError) setError(queryError.message); else setItems((data ?? []) as Homework[]);
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
    setForm({ title: '', class_name: classes[0], due_date: localDate(), due_time: '', priority: 'medium', notes: '' });
    setShowAdd(false);
    await load();
  }

  async function toggle(id: string, completed: boolean) {
    if (!supabase) return;
    const { error: updateError } = await supabase.from('homework').update({ completed }).eq('id', id);
    if (updateError) setError(updateError.message); else setItems(old => old.map(x => x.id === id ? { ...x, completed } : x));
  }

  async function remove(id: string) {
    if (!supabase || !confirm('Delete this assignment?')) return;
    const { error: deleteError } = await supabase.from('homework').delete().eq('id', id);
    if (deleteError) setError(deleteError.message); else setItems(old => old.filter(x => x.id !== id));
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div><p className="eyebrow">HOMEWORK HUB</p><h1>Stay on top of school.</h1></div>
        <button className="addTop" onClick={() => setShowAdd(true)}>＋ Add</button>
      </header>

      <section className="stats">
        <div className="stat"><span>Due today</span><strong>{todayCount}</strong></div>
        <div className="stat"><span>Overdue</span><strong className={overdueCount ? 'danger' : ''}>{overdueCount}</strong></div>
        <div className="stat"><span>Remaining</span><strong>{items.filter(x => !x.completed).length}</strong></div>
      </section>

      {error && <div className="error">{error}</div>}

      <div className="sectionHead"><div><h2>{filter === 'upcoming' ? 'Upcoming' : 'Completed'}</h2><p>{filter === 'upcoming' ? 'Your next assignments, sorted by due date.' : 'Nice work. Here is what you finished.'}</p></div><div className="segmented"><button className={filter === 'upcoming' ? 'active' : ''} onClick={() => setFilter('upcoming')}>Upcoming</button><button className={filter === 'completed' ? 'active' : ''} onClick={() => setFilter('completed')}>Done</button></div></div>

      <section className="list">
        {loading ? <div className="empty">Loading your homework…</div> : visible.length === 0 ? <div className="empty"><div className="emptyIcon">✓</div><h3>{filter === 'upcoming' ? 'You’re all caught up!' : 'Nothing completed yet.'}</h3><p>{filter === 'upcoming' ? 'Add an assignment when your next one comes in.' : 'Finished assignments will show up here.'}</p></div> : visible.map(item => (
          <article className={`card priority-${item.priority}`} key={item.id}>
            <button className={`check ${item.completed ? 'checked' : ''}`} onClick={() => toggle(item.id, !item.completed)} aria-label="Mark complete">{item.completed ? '✓' : ''}</button>
            <div className="cardBody"><div className="cardTop"><span className="classTag">{item.class_name}</span><span className={`priority ${item.priority}`}>{item.priority}</span></div><h3>{item.title}</h3>{item.notes && <p className="notes">{item.notes}</p>}<div className="due">{dueLabel(item)}{item.due_time ? ` · ${new Date(`2000-01-01T${item.due_time}`).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}` : ''}</div></div>
            <button className="delete" onClick={() => remove(item.id)} aria-label="Delete assignment">×</button>
          </article>
        ))}
      </section>

      <button className="floating" onClick={() => setShowAdd(true)}>＋</button>

      {showAdd && <div className="modalBackdrop" onClick={() => setShowAdd(false)}><form className="modal" onSubmit={addHomework} onClick={e => e.stopPropagation()}><div className="modalHead"><div><p className="eyebrow">NEW ASSIGNMENT</p><h2>Add homework</h2></div><button type="button" className="close" onClick={() => setShowAdd(false)}>×</button></div><label>Assignment<input autoFocus required value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="e.g. Chapter 4 practice" /></label><label>Class<select value={form.class_name} onChange={e => setForm({ ...form, class_name: e.target.value })}>{classes.map(c => <option key={c}>{c}</option>)}</select></label><div className="row"><label>Due date<input required type="date" value={form.due_date} onChange={e => setForm({ ...form, due_date: e.target.value })} /></label><label>Time<input type="time" value={form.due_time} onChange={e => setForm({ ...form, due_time: e.target.value })} /></label></div><label>Priority<select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value as Homework['priority'] })}><option value="low">Low</option><option value="medium">Medium</option><option value="high">High</option></select></label><label>Notes <span>(optional)</span><textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} placeholder="Anything you need to remember…" /></label><button className="save" type="submit">Add assignment</button></form></div>}
    </main>
  );
}
