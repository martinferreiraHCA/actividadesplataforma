(function () {
  'use strict';
  var TEMAS = ['', 'sereno', 'nocturno', 'amigable', 'hca'];
  var KEY = 'gen_tema';
  var DEFECTO = 'sereno';

  function aplicar(tema) {
    document.body.className = document.body.className
      .replace(/\btema-\S+/g, '').trim();
    if (tema) document.body.classList.add('tema-' + tema);

    var btns = document.querySelectorAll('.tema-btn');
    btns.forEach(function (b) {
      b.classList.toggle('active', b.dataset.tema === tema);
    });
  }

  var guardado = null;
  try { guardado = localStorage.getItem(KEY); } catch (e) {}
  // Si nunca eligió tema, arranca con el tema por defecto (amigable a la vista)
  if (guardado === null) guardado = DEFECTO;
  if (TEMAS.indexOf(guardado) === -1) guardado = DEFECTO;
  aplicar(guardado);

  document.addEventListener('click', function (e) {
    var btn = e.target.closest('.tema-btn');
    if (!btn) return;
    var tema = btn.dataset.tema;
    aplicar(tema);
    try { localStorage.setItem(KEY, tema); } catch (e) {}
  });
})();
