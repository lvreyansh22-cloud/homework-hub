'use client';

import { useState } from 'react';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const HAC_URL = 'https://hac23.esp.k12.ar.us';

export default function HACPage() {
  const [status, setStatus] = useState<'idle' | 'checking' | 'ready' | 'error'>('idle');
  const [message, setMessage] = useState('');

  async function checkConnector() {
    setStatus('checking');
    setMessage('Checking the secure HAC connector…');
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      setStatus('error');
      setMessage('Supabase is not configured in this deployment yet.');
      return;
    }

    try {
      const response = await fetch(`${SUPABASE_URL}/functions/v1/hac-sync`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${SUPABASE_KEY}`,
          apikey: SUPABASE_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'status' }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Connector check failed');
      setStatus(data.connected ? 'ready' : 'idle');
      setMessage(data.connected
        ? 'HAC is connected. Homework Hub can now request the enabled data.'
        : 'The secure connector is installed, but its approved PowerSchool connection details have not been configured yet.');
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error ? error.message : 'Connector check failed.');
    }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">HOMEWORK HUB</p>
          <h1>HAC Sync</h1>
        </div>
        <a className="secondaryTop" href="/">Back</a>
      </header>

      <section className="list">
        <article className="card">
          <div className="cardBody">
            <div className="cardTop"><span className="classTag">PowerSchool HAC</span><span className="priority medium">SECURE</span></div>
            <h3>Connect your school data</h3>
            <p className="notes">Homework Hub is set up with a server-side connector. Your HAC password is never entered into this app or stored in GitHub.</p>
            <div className="hints">
              <a href={HAC_URL} target="_blank" rel="noreferrer">Open HAC ↗</a>
              <button className="save" onClick={checkConnector} disabled={status === 'checking'}>
                {status === 'checking' ? 'Checking…' : 'Check connection'}
              </button>
            </div>
            {message && <div className={status === 'error' ? 'error' : 'nextClass'}>{message}</div>}
          </div>
        </article>
      </section>
    </main>
  );
}
