/* ============================================================
   WordNest — English–Bangla Dictionary  |  script.js
   ============================================================ */

/* ---- DOM refs ---- */
const searchInput       = document.getElementById('searchInput');
const searchBtn         = document.getElementById('searchBtn');
const searchMeta        = document.getElementById('searchMeta');
const loadingWrap       = document.getElementById('loadingWrap');
const errorCard         = document.getElementById('errorCard');
const result            = document.getElementById('result');
const wordTitle         = document.getElementById('wordTitle');
const phoneticsRow      = document.getElementById('phoneticsRow');
const audioBtns         = document.getElementById('audioBtns');
const banglaMeaning     = document.getElementById('banglaMeaning');
const meaningsContainer = document.getElementById('meaningsContainer');
const synonymsContainer = document.getElementById('synonymsContainer');
const antonymsContainer = document.getElementById('antonymsContainer');
const examplesContainer = document.getElementById('examplesContainer');
const pdfBtn            = document.getElementById('pdfBtn');
const historyCount      = document.getElementById('historyCount');
const historyList       = document.getElementById('historyList');
const clearHistoryBtn   = document.getElementById('clearHistoryBtn');
const panelToggleBtn    = document.getElementById('panelToggleBtn');
const historyPanel      = document.getElementById('historyPanel');

/* ---- State ---- */
const HISTORY_KEY = 'wordnest_history';
let currentData   = null;

/* ============================================================
   WORD SUGGESTIONS  — Full English dictionary via Datamuse API
   + history words shown first
   ============================================================ */
const suggestionsList = document.getElementById('suggestionsList');
let activeSugIdx  = -1;
let sugDebounce   = null;
let lastSugQuery  = '';
const sugCache    = {};          // cache results per query prefix

async function fetchWordSuggestions(query) {
  if (sugCache[query]) return sugCache[query];
  try {
    // sp=query* → words that spell-start with query (full dictionary)
    const res  = await fetch(`https://api.datamuse.com/words?sp=${encodeURIComponent(query)}*&max=50`);
    const data = await res.json();
    const words = data.map(d => d.word).filter(w => w.toLowerCase().startsWith(query.toLowerCase()));
    sugCache[query] = words;
    return words;
  } catch {
    return [];
  }
}

function highlightMatch(word, query) {
  const idx = word.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return `<span class="sug-rest">${word}</span>`;
  const before    = word.slice(0, idx);
  const matched   = word.slice(idx, idx + query.length);
  const remaining = word.slice(idx + query.length);
  return (before ? `<span class="sug-rest">${before}</span>` : '') +
    `<span class="sug-typed">${matched}</span>` +
    (remaining ? `<span class="sug-rest">${remaining}</span>` : '');
}

async function renderSuggestions(query) {
  if (!query || query.length < 1) { closeSuggestions(); return; }
  lastSugQuery = query;

  const history     = getHistory();
  const fromHistory = history.filter(w => w.toLowerCase().startsWith(query.toLowerCase()) && w.toLowerCase() !== query.toLowerCase()).slice(0, 4);

  // Show history matches immediately while API loads
  if (fromHistory.length) {
    buildSuggestionDOM(fromHistory.map(w => ({ word: w, isHistory: true })), query);
  }

  const apiWords  = await fetchWordSuggestions(query);
  // Skip if user already typed something else
  if (lastSugQuery !== query) return;

  const historySet = new Set(fromHistory.map(w => w.toLowerCase()));
  const fromApi    = apiWords
    .filter(w => !historySet.has(w.toLowerCase()) && w.toLowerCase() !== query.toLowerCase())
    .slice(0, 8);

  const combined = [
    ...fromHistory.map(w => ({ word: w, isHistory: true })),
    ...fromApi.map(w => ({ word: w, isHistory: false }))
  ].slice(0, 10);

  if (!combined.length) { closeSuggestions(); return; }
  buildSuggestionDOM(combined, query);
}

function buildSuggestionDOM(items, query) {
  activeSugIdx = -1;
  suggestionsList.innerHTML = items.map((item, i) => `
    <li class="suggestion-item ${item.isHistory ? 'from-history' : ''}" data-word="${item.word}" data-idx="${i}">
      <svg class="sug-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        ${item.isHistory
          ? '<path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="9"/>'
          : '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>'}
      </svg>
      <span class="sug-word">${highlightMatch(item.word, query)}</span>
    </li>
  `).join('');
  suggestionsList.classList.add('open');

  suggestionsList.querySelectorAll('.suggestion-item').forEach(li => {
    li.addEventListener('mousedown', (e) => {
      e.preventDefault();
      closeSuggestions();
      triggerSearch(li.getAttribute('data-word'));
    });
  });
}

function closeSuggestions() {
  suggestionsList.innerHTML = '';
  suggestionsList.classList.remove('open');
  activeSugIdx = -1;
}

function navigateSuggestions(dir) {
  const items = suggestionsList.querySelectorAll('.suggestion-item');
  if (!items.length) return;
  items.forEach(i => i.classList.remove('active'));
  if (dir === 1) activeSugIdx = activeSugIdx >= items.length - 1 ? 0 : activeSugIdx + 1;
  else           activeSugIdx = activeSugIdx <= 0 ? items.length - 1 : activeSugIdx - 1;
  items[activeSugIdx].classList.add('active');
  searchInput.value = items[activeSugIdx].getAttribute('data-word');
}

// Input events
searchInput.addEventListener('input', () => {
  clearTimeout(sugDebounce);
  const q = searchInput.value.trim();
  if (!q) { closeSuggestions(); return; }
  sugDebounce = setTimeout(() => renderSuggestions(q), 200);
});

searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowDown') { e.preventDefault(); navigateSuggestions(1);  return; }
  if (e.key === 'ArrowUp')   { e.preventDefault(); navigateSuggestions(-1); return; }
  if (e.key === 'Escape')    { closeSuggestions(); return; }
  if (e.key === 'Enter') {
    closeSuggestions();
    triggerSearch(searchInput.value);
  }
});

document.addEventListener('click', (e) => {
  if (!e.target.closest('.search-wrapper')) closeSuggestions();
});

/* ============================================================
   COLLAPSIBLE SECTIONS
   ============================================================ */
function initCollapsibles() {
  document.querySelectorAll('.card-header').forEach(header => {
    header.addEventListener('click', () => {
      const targetId = header.getAttribute('data-target');
      const section  = document.getElementById(targetId);
      if (section) section.classList.toggle('collapsed');
    });
  });
}

/* ============================================================
   HISTORY PANEL MINIMIZE / MAXIMIZE
   ============================================================ */
panelToggleBtn.addEventListener('click', () => {
  historyPanel.classList.toggle('panel-minimized');
});

/* ============================================================
   HISTORY
   ============================================================ */
function getHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; }
  catch { return []; }
}
function saveHistory(list) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(list));
}
function addToHistory(word) {
  const w = word.toLowerCase().trim();
  let list = getHistory();
  list = list.filter(x => x !== w);
  list.unshift(w);
  if (list.length > 100) list = list.slice(0, 100);
  saveHistory(list);
  renderHistory();
}
function renderHistory() {
  const list = getHistory();
  historyCount.textContent = list.length;
  historyList.innerHTML = '';
  list.forEach(word => {
    const li = document.createElement('li');
    li.className = 'history-item';
    li.textContent = word;
    li.addEventListener('click', () => triggerSearch(word));
    historyList.appendChild(li);
  });
  searchMeta.textContent = list.length
    ? `${list.length} word${list.length !== 1 ? 's' : ''} searched`
    : '';
}
clearHistoryBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  if (confirm('Clear all search history?')) {
    saveHistory([]);
    renderHistory();
  }
});

/* ============================================================
   UI STATE
   ============================================================ */
function showLoading() {
  loadingWrap.classList.add('active');
  errorCard.classList.remove('active');
  result.classList.remove('active');
}
function showError() {
  loadingWrap.classList.remove('active');
  errorCard.classList.add('active');
  result.classList.remove('active');
}
function showResult() {
  loadingWrap.classList.remove('active');
  errorCard.classList.remove('active');
  result.classList.add('active');
}

/* ============================================================
   DICTIONARY API
   ============================================================ */
async function fetchDefinition(word) {
  const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
  if (!res.ok) throw new Error('not found');
  return res.json();
}

/* ============================================================
   TRANSLATION API
   ============================================================ */
async function translateToBangla(text) {
  try {
    const url  = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|bn`;
    const res  = await fetch(url);
    const data = await res.json();
    if (data.responseStatus === 200) return data.responseData.translatedText;
    return '—';
  } catch { return '—'; }
}

/* ============================================================
   RENDER HELPERS
   ============================================================ */
function renderPhonetics(entries) {
  phoneticsRow.innerHTML = '';
  const seen = new Set();
  entries.forEach(entry => {
    (entry.phonetics || []).forEach(ph => {
      if (ph.text && !seen.has(ph.text)) {
        seen.add(ph.text);
        const chip = document.createElement('span');
        chip.className = 'phonetic-chip';
        chip.textContent = ph.text;
        phoneticsRow.appendChild(chip);
      }
    });
  });
}

function findAudio(entries, region) {
  const all = entries.flatMap(e => e.phonetics || []);
  const match = all.find(ph => {
    const u = (ph.audio || '').toLowerCase();
    return u && u.includes(region === 'uk' ? '-uk' : '-us');
  });
  if (match?.audio) return match.audio;
  return all.find(ph => ph.audio)?.audio || '';
}

function renderAudioBtns(entries) {
  audioBtns.innerHTML = '';
  const makeBtn = (label, audioUrl) => {
    const btn = document.createElement('button');
    btn.className = 'audio-btn';
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>${label}`;
    if (!audioUrl) {
      btn.disabled = true;
      btn.title = 'Audio not available';
    } else {
      btn.addEventListener('click', () => new Audio(audioUrl).play().catch(() => {}));
    }
    audioBtns.appendChild(btn);
  };
  makeBtn('🇬🇧 UK', findAudio(entries, 'uk'));
  makeBtn('🇺🇸 US', findAudio(entries, 'us'));
}

function renderMeanings(entries) {
  meaningsContainer.innerHTML = '';
  entries.forEach(entry => {
    (entry.meanings || []).forEach(meaning => {
      const group = document.createElement('div');
      group.className = 'pos-group';

      const posLabel = document.createElement('span');
      posLabel.className = 'pos-label';
      posLabel.textContent = meaning.partOfSpeech;
      group.appendChild(posLabel);

      const ul = document.createElement('ul');
      ul.className = 'def-list';
      meaning.definitions.forEach((def, i) => {
        const li = document.createElement('li');
        li.className = 'def-item';
        li.innerHTML = `<span class="def-num">${String(i + 1).padStart(2, '0')}</span><span class="def-text">${def.definition}</span>`;
        ul.appendChild(li);
      });
      group.appendChild(ul);
      meaningsContainer.appendChild(group);
    });
  });
}

function collectSynonymsAntonyms(entries) {
  const syns = new Set(), ants = new Set();
  entries.forEach(e => {
    (e.meanings || []).forEach(m => {
      (m.synonyms || []).forEach(s => syns.add(s));
      (m.antonyms || []).forEach(a => ants.add(a));
      m.definitions.forEach(d => {
        (d.synonyms || []).forEach(s => syns.add(s));
        (d.antonyms || []).forEach(a => ants.add(a));
      });
    });
  });
  return { synonyms: [...syns], antonyms: [...ants] };
}

function renderTags(container, words, cls) {
  container.innerHTML = '';
  if (!words.length) {
    container.innerHTML = '<span class="empty-state">None found</span>';
    return;
  }
  words.slice(0, 30).forEach(w => {
    const span = document.createElement('span');
    span.className = `tag ${cls}`;
    span.textContent = w;
    span.title = `Search "${w}"`;
    span.addEventListener('click', () => triggerSearch(w));
    container.appendChild(span);
  });
}

function collectExamples(entries) {
  const out = [];
  entries.forEach(e => {
    (e.meanings || []).forEach(m => {
      m.definitions.forEach(d => {
        if (d.example && !out.includes(d.example)) out.push(d.example);
      });
    });
  });
  return out;
}

function renderExamples(examples) {
  examplesContainer.innerHTML = '';
  if (!examples.length) {
    examplesContainer.innerHTML = '<li class="empty-state" style="padding:4px 0">No examples available.</li>';
    return;
  }
  examples.forEach(ex => {
    const li = document.createElement('li');
    li.className = 'example-item';
    li.textContent = ex;
    examplesContainer.appendChild(li);
  });
}

/* ============================================================
   MAIN SEARCH
   ============================================================ */
async function triggerSearch(word) {
  word = word.trim();
  if (!word) return;
  searchInput.value = word;
  showLoading();
  window.scrollTo({ top: 0, behavior: 'smooth' });
  banglaMeaning.innerHTML = '<span class="shimmer-line"></span>';

  try {
    const entries = await fetchDefinition(word);
    addToHistory(word);

    wordTitle.textContent = entries[0]?.word || word;
    renderPhonetics(entries);
    renderAudioBtns(entries);
    renderMeanings(entries);

    const { synonyms, antonyms } = collectSynonymsAntonyms(entries);
    renderTags(synonymsContainer, synonyms, 'tag-syn');
    renderTags(antonymsContainer, antonyms, 'tag-ant');

    const examples = collectExamples(entries);
    renderExamples(examples);

    showResult();
    currentData = { word, entries, synonyms, antonyms, examples };

    // Bangla async
    translateToBangla(word).then(bangla => {
      banglaMeaning.textContent = bangla || '—';
      if (currentData) currentData.bangla = bangla;
    });

  } catch {
    showError();
  }
}

searchBtn.addEventListener('click', () => { closeSuggestions(); triggerSearch(searchInput.value); });

/* ============================================================
   PDF  —  English meanings of EVERY history word
   ============================================================ */
pdfBtn.addEventListener('click', generatePDF);

async function generatePDF() {
  const history = getHistory();
  if (!history.length) {
    alert('No search history yet. Search some words first!');
    return;
  }

  /* Show progress on button */
  pdfBtn.disabled = true;
  const origHTML = pdfBtn.innerHTML;
  pdfBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg> Building PDF…`;

  /* Fetch definitions for all history words (with concurrency limit) */
  const BATCH = 5;
  const results = [];
  for (let i = 0; i < history.length; i += BATCH) {
    const batch = history.slice(i, i + BATCH);
    const fetched = await Promise.all(
      batch.map(async word => {
        try {
          const entries = await fetchDefinition(word);
          return { word, entries };
        } catch {
          return { word, entries: null };
        }
      })
    );
    results.push(...fetched);
    // Update button progress
    pdfBtn.innerHTML = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg> ${Math.min(i + BATCH, history.length)}/${history.length} fetched…`;
  }

  /* Build PDF */
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W  = doc.internal.pageSize.getWidth();   // 210 mm
  const mL = 16, mR = 16;
  const cW = W - mL - mR;                        // 178 mm usable
  let y = 0;

  const LINE_H   = 5.5;   // mm per line of body text (9pt)
  const PAGE_MAX = 276;   // mm — leave 6mm footer gap

  /* Helper: add a page-header blue bar */
  function pageHeader() {
    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, W, 13, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    doc.text('WordNest — History Meanings', mL, 8.5);
    doc.text(`${history.length} words  ·  ${new Date().toLocaleDateString('en-GB')}`, W - mR, 8.5, { align: 'right' });
  }

  const addPage = () => {
    doc.addPage();
    pageHeader();
    y = 22;
  };

  // checkY: ensure 'need' mm remain; if not, new page
  const checkY = (need = 12) => { if (y + need > PAGE_MAX) addPage(); };

  // writeWrapped: write text with proper wrapping, return new y
  function writeWrapped(text, x, maxW, fontStyle, fontSize, r, g, b) {
    doc.setFont('helvetica', fontStyle);
    doc.setFontSize(fontSize);
    doc.setTextColor(r, g, b);
    const lines = doc.splitTextToSize(text, maxW);
    const block = lines.length * LINE_H;
    checkY(block + 2);
    doc.text(lines, x, y);
    y += block;
    return y;
  }

  /* First page header */
  pageHeader();
  y = 22;

  /* Cover line */
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(37, 99, 235);
  doc.text(`English Meanings for ${history.length} Searched Word${history.length !== 1 ? 's' : ''}`, mL, y);
  y += 4;
  doc.setDrawColor(37, 99, 235);
  doc.setLineWidth(0.4);
  doc.line(mL, y, W - mR, y);
  y += 8;

  /* Loop every word */
  results.forEach(({ word, entries }, wordIdx) => {

    /* ---- Word heading ---- */
    checkY(20);

    doc.setFont('times', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(22, 32, 46);
    doc.text(`${wordIdx + 1}.  ${word}`, mL, y);
    y += 2;

    doc.setDrawColor(200, 210, 230);
    doc.setLineWidth(0.3);
    doc.line(mL, y, mL + cW * 0.45, y);
    y += 6;

    if (!entries) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(9);
      doc.setTextColor(180, 80, 80);
      doc.text('Word not found in dictionary.', mL + 4, y);
      y += 10;
      return;
    }

    /* ---- Meanings per part-of-speech ---- */
    entries.forEach(entry => {
      (entry.meanings || []).forEach(meaning => {
        checkY(14);

        // POS label
        doc.setFont('helvetica', 'bolditalic');
        doc.setFontSize(8.5);
        doc.setTextColor(13, 148, 136);
        doc.text(`[ ${meaning.partOfSpeech} ]`, mL + 3, y);
        y += LINE_H + 0.5;

        meaning.definitions.forEach((def, i) => {
          // Use (cW - 10) for indented text so long words wrap correctly
          const text  = `${i + 1}.  ${def.definition}`;
          const indentX = mL + 6;
          const textW   = cW - 10;

          doc.setFont('helvetica', 'normal');
          doc.setFontSize(9);
          doc.setTextColor(58, 74, 92);
          const lines = doc.splitTextToSize(text, textW);
          const blockH = lines.length * LINE_H;
          checkY(blockH + 2);
          doc.text(lines, indentX, y);
          y += blockH + 2;
        });
        y += 3;
      });
    });

    y += 3;

    /* Light separator between words */
    if (wordIdx < results.length - 1) {
      checkY(8);
      doc.setDrawColor(220, 230, 242);
      doc.setLineWidth(0.22);
      doc.line(mL, y, W - mR, y);
      y += 6;
    }
  });

  doc.save(`wordnest-all-history.pdf`);

  /* Restore button */
  pdfBtn.disabled = false;
  pdfBtn.innerHTML = origHTML;
}

/* ============================================================
   INIT
   ============================================================ */
initCollapsibles();
renderHistory();
searchInput.focus();