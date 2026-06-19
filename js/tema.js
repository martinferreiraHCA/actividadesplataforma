(function () {
  'use strict';
  var TEMAS = ['', 'nocturno', 'amigable', 'hca'];
  var KEY = 'hca_tema';

  function aplicar(tema) {
    document.body.className = document.body.className
      .replace(/\btema-\S+/g, '').trim();
    if (tema) document.body.classList.add('tema-' + tema);

    var btns = document.querySelectorAll('.tema-btn');
    btns.forEach(function (b) {
      b.classList.toggle('active', b.dataset.tema === tema);
    });
  }

  var guardado = '';
  try { guardado = localStorage.getItem(KEY) || ''; } catch (e) {}
  if (TEMAS.indexOf(guardado) === -1) guardado = '';
  aplicar(guardado);

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.tema-btn');
    if (!btn) return;
    var tema = btn.dataset.tema;
    aplicar(tema);
    try { localStorage.setItem(KEY, tema); } catch (e) {}
  });
})();
