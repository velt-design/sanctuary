;(function () {
  try {
    var script = document.currentScript || document.querySelector('script[data-ga-id]');
    if (!script) return;
    var gaId = script.getAttribute('data-ga-id');
    if (!gaId) return;

    window.dataLayer = window.dataLayer || [];
    function gtag() {
      window.dataLayer.push(arguments);
    }

    // Expose gtag globally if not already present
    if (typeof window.gtag !== 'function') {
      window.gtag = gtag;
    }

    window.gtag('js', new Date());
    window.gtag('config', gaId, {
      anonymize_ip: true,
      transport_type: 'beacon',
    });
  } catch (e) {
    console.warn('GA init failed', e);
  }
})();

