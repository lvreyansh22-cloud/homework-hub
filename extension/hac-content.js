(() => {
  const normalize = text => (text || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();

  function toIsoDate(value) {
    const text = normalize(value);
    const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (!match) return '';
    const [, month, day, year] = match;
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  function classNameFor(table) {
    let node = table;
    for (let depth = 0; depth < 6 && node; depth++, node = node.parentElement) {
      const candidates = Array.from(node.querySelectorAll('h1,h2,h3,h4,h5,h6,legend,caption,.SectionHeader,.classHeader,.header'));
      for (let i = candidates.length - 1; i >= 0; i--) {
        const text = normalize(candidates[i].textContent);
        const match = text.match(/\b\d{6}\s*-\s*\d+\s+(.+?)(?:\s+Average\b|$)/i);
        if (match) return normalize(match[1]);
      }

      const before = [];
      let sibling = table.previousElementSibling;
      for (let i = 0; i < 8 && sibling; i++, sibling = sibling.previousElementSibling) before.push(sibling);
      for (const element of before) {
        const text = normalize(element.textContent);
        const match = text.match(/\b\d{6}\s*-\s*\d+\s+(.+?)(?:\s+Average\b|$)/i);
        if (match) return normalize(match[1]);
      }
    }
    return 'HAC Classwork';
  }

  function parseTable(table) {
    const rows = Array.from(table.rows || []);
    if (!rows.length) return [];

    let headerIndex = -1;
    let headers = [];
    for (let i = 0; i < Math.min(rows.length, 5); i++) {
      const cells = Array.from(rows[i].cells || []).map(c => normalize(c.textContent).toLowerCase());
      if (cells.some(x => x.includes('date due')) && cells.some(x => x.includes('assignment'))) {
        headerIndex = i;
        headers = cells;
        break;
      }
    }
    if (headerIndex < 0) return [];

    const indexOf = phrase => headers.findIndex(x => x.includes(phrase));
    const dueIndex = indexOf('date due');
    const assignedIndex = indexOf('date assigned');
    const assignmentIndex = indexOf('assignment');
    const categoryIndex = indexOf('category');
    const scoreIndex = indexOf('score');
    const totalIndex = indexOf('total points');
    const className = classNameFor(table);

    return rows.slice(headerIndex + 1).map(row => {
      const cells = Array.from(row.cells || []).map(c => normalize(c.textContent));
      const due = toIsoDate(cells[dueIndex] || '');
      const title = normalize(cells[assignmentIndex] || '');
      if (!due || !title || title.toLowerCase() === 'assignment') return null;
      return {
        class_name: className,
        due_date: due,
        assigned_date: toIsoDate(cells[assignedIndex] || '') || null,
        title,
        category: categoryIndex >= 0 ? cells[categoryIndex] || null : null,
        score: scoreIndex >= 0 ? cells[scoreIndex] || null : null,
        total_points: totalIndex >= 0 ? cells[totalIndex] || null : null
      };
    }).filter(Boolean);
  }

  function parse() {
    const assignments = [];
    for (const table of Array.from(document.querySelectorAll('table'))) assignments.push(...parseTable(table));
    const unique = [];
    const seen = new Set();
    for (const item of assignments) {
      const key = `${item.class_name}|${item.title}|${item.due_date}`.toLowerCase();
      if (!seen.has(key)) { seen.add(key); unique.push(item); }
    }
    chrome.runtime.sendMessage({ type: 'HAC_PARSED', assignments: unique });
    console.info(`[Homework Hub] Imported ${unique.length} HAC assignments.`);
  }

  let lastUrl = location.href;
  parse();
  setInterval(() => {
    if (location.href !== lastUrl) { lastUrl = location.href; if (location.pathname.includes('/HomeAccess/Classes/Classwork')) setTimeout(parse, 700); }
  }, 1000);
})();
