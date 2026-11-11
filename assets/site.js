// © 2026 Mike Pollow, Digitalroots. Alle Rechte vorbehalten.
const meldung = document.querySelector('.meldung');

for (const knopf of document.querySelectorAll('[data-kopie]')) {
  const beschriftung = knopf.textContent;
  knopf.addEventListener('click', async () => {
    const quelle = document.getElementById(knopf.dataset.kopie);
    try {
      await navigator.clipboard.writeText(quelle.textContent.trim());
    } catch {
      const bereich = document.createRange();
      bereich.selectNodeContents(quelle);
      const auswahl = getSelection();
      auswahl.removeAllRanges();
      auswahl.addRange(bereich);
      return;
    }
    knopf.textContent = knopf.dataset.fertig;
    meldung.textContent = knopf.dataset.fertig;
    setTimeout(() => {
      knopf.textContent = beschriftung;
      meldung.textContent = '';
    }, 1800);
  });
}

const filme = [...document.querySelectorAll('.film')];
const schmal = matchMedia('(max-width: 759px)');
const sichtbar = new WeakSet();
const angehalten = new WeakSet();
const spielbar = film => film.offsetParent !== null && !(schmal.matches && film.closest('.fenster-terminal'));
const abgleichen = film => {
  const fenster = film.closest('.fenster');
  if (sichtbar.has(film) && spielbar(film) && !angehalten.has(fenster) && !document.hidden) film.play().catch(() => {});
  else film.pause();
};

if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
  for (const film of filme) {
    if (film.dataset.ruhebild) film.poster = film.dataset.ruhebild;
    if (spielbar(film)) film.controls = true;
  }
} else {
  const texte = document.getElementById('inhalt').dataset;
  const zeichen = {
    pause: '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 1.5h2.5v9H2.5zM7 1.5h2.5v9H7z"/></svg>',
    weiter: '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 1.2 10.5 6 3 10.8z"/></svg>',
  };
  for (const fenster of document.querySelectorAll('.fenster')) {
    const knopf = document.createElement('button');
    knopf.type = 'button';
    knopf.className = 'halt';
    const zeigen = () => {
      const steht = angehalten.has(fenster);
      knopf.innerHTML = steht ? zeichen.weiter : zeichen.pause;
      knopf.setAttribute('aria-label', steht ? texte.weiter : texte.pause);
    };
    knopf.addEventListener('click', () => {
      if (angehalten.has(fenster)) angehalten.delete(fenster);
      else angehalten.add(fenster);
      zeigen();
      for (const film of fenster.querySelectorAll('.film')) abgleichen(film);
    });
    zeigen();
    fenster.append(knopf);
  }
  const blick = new IntersectionObserver(eintraege => {
    for (const eintrag of eintraege) {
      if (eintrag.isIntersecting) sichtbar.add(eintrag.target);
      else sichtbar.delete(eintrag.target);
      abgleichen(eintrag.target);
    }
  }, { threshold: 0.35 });
  for (const film of filme) blick.observe(film);
  document.addEventListener('visibilitychange', () => filme.forEach(abgleichen));
  schmal.addEventListener('change', () => filme.forEach(abgleichen));
}
