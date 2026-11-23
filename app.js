'use strict';
(() => {
  const slides = [...document.querySelectorAll('.slide')];
  const durations = slides.map(slide => Number(slide.dataset.seconds));
  const total = durations.reduce((a, b) => a + b, 0);
  const cumulative = durations.map((_, i) => durations.slice(0, i).reduce((a, b) => a + b, 0));
  const $ = id => document.getElementById(id);
  let current = Math.max(0, slides.findIndex(slide => `#${slide.id}` === location.hash));
  let elapsed = 0, running = false, startedAt = 0, interval, notes = [], toastTimeout;
  const dots = document.querySelector('.page-dots');
  slides.forEach((slide, i) => {
    const dot = document.createElement('button');
    dot.setAttribute('aria-label', `第 ${i + 1} 頁：${slide.getAttribute('aria-label').split('：')[1]}`);
    dot.addEventListener('click', () => show(i));
    dots.append(dot);
  });
  function format(seconds) {
    const n = Math.max(0, Math.ceil(seconds));
    return `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;
  }
  function toast(message) {
    $('toast').textContent = message;
    $('toast').hidden = false;
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => { $('toast').hidden = true; }, 4000);
  }
  function updateNotes() {
    const note = notes.find(item => item.id === slides[current].id);
    $('notes-title').textContent = note?.title || slides[current].getAttribute('aria-label').split('：')[1];
    $('notes-timing').textContent = `建議 ${durations[current]} 秒　｜　${format(cumulative[current])} 至 ${format(cumulative[current] + durations[current])}`;
    $('notes-script').textContent = note?.script || '正在載入講稿……';
    $('speaker-notes').scrollTop = 0;
  }
  function show(index, {syncClock = true, updateHash = true} = {}) {
    current = Math.max(0, Math.min(slides.length - 1, index));
    slides.forEach((slide, i) => { slide.hidden = i !== current; slide.classList.toggle('active', i === current); });
    if (updateHash) history.replaceState(null, '', `#${slides[current].id}`);
    $('previous').disabled = current === 0;
    $('next').disabled = current === slides.length - 1;
    $('page-count').textContent = `${String(current + 1).padStart(2, '0')} / ${String(slides.length).padStart(2, '0')}`;
    [...dots.children].forEach((dot, i) => dot.setAttribute('aria-current', String(i === current)));
    document.querySelectorAll('[data-goto]').forEach(button => {
      const part = slides.find(slide => slide.id === button.dataset.goto).dataset.part;
      if (part === slides[current].dataset.part) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });
    $('progress-fill').style.transform = `scaleX(${(current + 1) / slides.length})`;
    $('slide-announcement').textContent = slides[current].getAttribute('aria-label') + `，共 ${slides.length} 頁`;
    if (syncClock && $('auto-advance').checked) {
      elapsed = cumulative[current];
      if (running) startedAt = performance.now() - elapsed * 1000;
      renderClock();
    }
    updateNotes();
    if (matchMedia('(max-width:700px)').matches) window.scrollTo({top:0,behavior:'instant'});
  }
  function renderClock() {
    $('timer-value').textContent = format(total - elapsed);
    $('timer-button').setAttribute('aria-pressed', String(running));
    $('timer-label').textContent = running ? '暫停計時' : elapsed >= total ? '重新計時' : elapsed > 0 ? '繼續計時' : '開始計時';
    $('timer-button').setAttribute('aria-label', `${$('timer-label').textContent}，剩餘 ${format(total - elapsed)}`);
  }
  function tick() {
    elapsed = Math.min(total, (performance.now() - startedAt) / 1000);
    if ($('auto-advance').checked) {
      let target = 0;
      while (target < slides.length - 1 && elapsed >= cumulative[target + 1]) target++;
      if (target !== current) show(target, {syncClock:false});
    }
    if (elapsed >= total) {
      running = false; clearInterval(interval); toast('三分半鐘已完成。');
    }
    renderClock();
  }
  function pauseClock() {
    if (!running) return;
    elapsed = Math.min(total, (performance.now() - startedAt) / 1000);
    running = false; clearInterval(interval); renderClock();
  }
  function toggleClock() {
    if (running) { pauseClock(); return; }
    if (elapsed >= total) { elapsed = 0; if ($('auto-advance').checked) show(0, {syncClock:false}); }
    running = true;
    startedAt = performance.now() - elapsed * 1000;
    interval = setInterval(tick, 100);
    renderClock();
  }
  function toggleNotes(force) {
    const open = force ?? $('speaker-notes').hidden;
    if (open) pauseClock();
    $('speaker-notes').hidden = !open;
    $('notes-button').setAttribute('aria-pressed', String(open));
    if (open) $('close-notes').focus();
    else $('notes-button').focus();
  }
  async function fullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (document.documentElement.requestFullscreen) await document.documentElement.requestFullscreen();
      else toast('此瀏覽器未提供全螢幕，請使用瀏覽器的全螢幕功能。');
    } catch { toast('無法開啟全螢幕，請使用瀏覽器的全螢幕功能。'); }
  }
  $('previous').addEventListener('click', () => show(current - 1));
  $('next').addEventListener('click', () => show(current + 1));
  document.querySelectorAll('[data-goto]').forEach(button => button.addEventListener('click', () => show(slides.findIndex(slide => slide.id === button.dataset.goto))));
  $('timer-button').addEventListener('click', toggleClock);
  $('reset-timer').addEventListener('click', () => {pauseClock(); elapsed = 0; if ($('auto-advance').checked) show(0, {syncClock:false}); renderClock();});
  $('auto-advance').addEventListener('change', () => {
    if ($('auto-advance').checked) {
      elapsed = cumulative[current];
      if (running) startedAt = performance.now() - elapsed * 1000;
      renderClock();
      toast('已開啟按講稿時長自動翻頁；計時由目前頁開始。');
    }
  });
  $('notes-button').addEventListener('click', () => toggleNotes());
  $('close-notes').addEventListener('click', () => toggleNotes(false));
  $('fullscreen').addEventListener('click', fullscreen);
  $('sources-button').addEventListener('click', () => {pauseClock(); $('sources-dialog').showModal();});
  $('close-sources').addEventListener('click', () => $('sources-dialog').close());
  $('sources-dialog').addEventListener('click', event => {if (event.target === $('sources-dialog')) {const r = event.target.getBoundingClientRect(); if(event.clientX < r.left || event.clientX > r.right || event.clientY < r.top || event.clientY > r.bottom) event.target.close();}});
  window.addEventListener('hashchange', () => {const index = slides.findIndex(slide => `#${slide.id}` === location.hash); if(index >= 0) show(index, {updateHash:false});});
  document.addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.target.closest('input,textarea,select,[contenteditable]') || $('sources-dialog').open) return;
    if (event.key === 'Escape' && !$('speaker-notes').hidden) {toggleNotes(false); return;}
    if (event.key.toLowerCase() === 'n') {event.preventDefault(); toggleNotes(); return;}
    if (event.key.toLowerCase() === 'f') {event.preventDefault(); fullscreen(); return;}
    if (event.key === ' ' && !event.target.closest('button,a')) {event.preventDefault(); toggleClock(); return;}
    if (!['ArrowRight','ArrowLeft','PageDown','PageUp','Home','End'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'Home') show(0);
    else if (event.key === 'End') show(slides.length - 1);
    else show(current + (['ArrowRight','PageDown'].includes(event.key) ? 1 : -1));
  });
  document.addEventListener('visibilitychange', () => {if (document.hidden && running) pauseClock();});
  show(current, {syncClock:false}); renderClock();
  fetch('assets/notes.json').then(response => {if(!response.ok) throw new Error(); return response.json();}).then(data => {notes = data; updateNotes();}).catch(() => {$('notes-script').textContent = '講稿未能載入，請使用下方連結下載完整講稿。';});
})();
