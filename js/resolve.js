(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.resolveScenario = factory().resolveScenario;
})(typeof self !== 'undefined' ? self : this, function () {
  function resolveScenario(shop, id) {
    var base = {
      id: null, version: null, title: null, task: null, accept: [], default_policy: null, expected_outcome: null,
      brand: shop.brand, currency: shop.currency, categories: shop.categories, merchants: shop.merchants,
      shipping: shop.shipping, fees: [], options: {}, traps: [], featured: shop.featured || [],
      products: JSON.parse(JSON.stringify(shop.products)),
    };
    if (!id) return base;
    var s = (shop.scenarios || []).filter(function (x) { return x.id === id; })[0];
    if (!s) return null;
    var products = base.products;
    Object.keys(s.products || {}).forEach(function (pid) {
      products[pid] = Object.assign({}, products[pid] || {}, s.products[pid]);
    });
    return Object.assign(base, {
      id: s.id, version: s.version, title: s.title, task: s.task, accept: s.accept.slice(),
      default_policy: s.default_policy, expected_outcome: s.expected_outcome,
      fees: s.fees || [], options: s.options || {}, traps: s.traps || [], featured: s.featured || base.featured,
      products: products,
    });
  }
  return { resolveScenario: resolveScenario };
});
