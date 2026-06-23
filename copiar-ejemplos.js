// Copy buttons for the format example boxes — classic script (no module)
(function () {
  'use strict';

  function copiarTexto(texto) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(texto);
    }
    // Fallback para contextos sin Clipboard API
    return new Promise(function (resolve, reject) {
      try {
        var ta = document.createElement('textarea');
        ta.value = texto;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        document.execCommand('copy');
        document.body.removeChild(ta);
        resolve();
      } catch (e) { reject(e); }
    });
  }

  function init() {
    document.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('[data-copiar-ejemplo]') : null;
      if (!btn) return;
      e.preventDefault();
      var wrap = btn.closest('.formato-ejemplo-wrap');
      var pre = wrap ? wrap.querySelector('.formato-ejemplo') : null;
      if (!pre) return;
      copiarTexto(pre.textContent).then(function () {
        var original = btn.getAttribute('data-label') || 'Copiar';
        if (!btn.getAttribute('data-label')) btn.setAttribute('data-label', btn.textContent);
        btn.textContent = '✓ Copiado';
        btn.classList.add('formato-copiar--ok');
        setTimeout(function () {
          btn.textContent = btn.getAttribute('data-label');
          btn.classList.remove('formato-copiar--ok');
        }, 1800);
      }).catch(function () {
        btn.textContent = 'Error';
        setTimeout(function () { btn.textContent = 'Copiar'; }, 1800);
      });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
