;(function () {
  try {
    if (typeof window === 'undefined' || !window.webVitals) return;

    function sendToGA(metric) {
      var name = metric.name;
      var value = metric.value;
      var id = metric.id;
      var scaled = name === 'CLS' ? Math.round(value * 1000) : Math.round(value);
      if (typeof window.gtag !== 'function') return;
      window.gtag('event', name, {
        value: scaled,
        metric_id: id,
        metric_value: value,
        non_interaction: true,
        event_category: 'Web Vitals',
      });
    }

    window.webVitals.onCLS(sendToGA);
    window.webVitals.onLCP(sendToGA);
    window.webVitals.onINP(sendToGA);
    if (window.webVitals.onFID) window.webVitals.onFID(sendToGA);
    if (window.webVitals.onFCP) window.webVitals.onFCP(sendToGA);
    if (window.webVitals.onTTFB) window.webVitals.onTTFB(sendToGA);
  } catch (e) {
    console.warn('Web Vitals init failed', e);
  }
})();
