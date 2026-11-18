(function () {
  'use strict';

  var TERMINAL = ['pay', 'request_confirmation', 'abandon'];
  var params = new URLSearchParams(location.search);
  var scenarioId = params.get('scenario');
  var app = document.getElementById('app');
  var shop = null;
  var run = null;

  function money(cents) { return (cents / 100).toFixed(2) + ' ' + shop.currency; }
  function el(tag, attrs, children) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') n.textContent = attrs[k];
      else if (k === 'on') Object.keys(attrs.on).forEach(function (ev) { n.addEventListener(ev, attrs.on[ev]); });
      else if (attrs[k] !== false && attrs[k] != null) n.setAttribute(k, attrs[k] === true ? '' : attrs[k]);
    });
    (children || []).forEach(function (c) { if (c != null) n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return n;
  }
  function store(fn) { try { return fn(window.sessionStorage); } catch (e) { return null; } }
  function newId() {
    try { return crypto.randomUUID(); } catch (e) { return 'run-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  }

  function loadRun() {
    var id = params.get('run');
    if (!id) {
      id = newId();
      params.set('run', id);
      history.replaceState(null, '', location.pathname + '?' + params.toString() + location.hash);
    }
    var saved = store(function (s) { return s.getItem('jeteste-run:' + id); });
    if (saved) { try { return JSON.parse(saved); } catch (e) { } }
    return {
      format: 'jeteste-qa/checkout-run', version: 1, run_id: id,
      scenario: { id: shop.id, version: shop.version }, started_at: new Date().toISOString(), events: [],
    };
  }
  function ended() { return run.events.some(function (e) { return TERMINAL.indexOf(e.type) >= 0; }); }
  function log(event) {
    if (ended()) return false;
    event.t = new Date().toISOString();
    run.events.push(event);
    store(function (s) { s.setItem('jeteste-run:' + run.run_id, JSON.stringify(run)); });
    window.__checkoutRun = run;
    document.getElementById('journal-text').textContent = JSON.stringify(run, null, 2);
    return true;
  }

  function state() {
    var cart = {}, shipping = null, options = {};
    Object.keys(shop.options).forEach(function (id) { options[id] = !!shop.options[id].default_checked; });
    run.events.forEach(function (e) {
      if (e.type === 'add_to_cart') cart[e.product_id] = (cart[e.product_id] || 0) + (e.qty || 1);
      if (e.type === 'remove_from_cart') delete cart[e.product_id];
      if (e.type === 'set_shipping') shipping = e.option_id;
      if (e.type === 'set_option') options[e.option_id] = !!e.checked;
    });
    var lines = Object.keys(cart).map(function (pid) { return { pid: pid, qty: cart[pid], p: shop.products[pid] }; });
    var subtotal = lines.reduce(function (n, l) { return n + l.p.price_cents * l.qty; }, 0);
    var ship = shipping ? shop.shipping[shipping].fee_cents : 0;
    var fees = shop.fees.reduce(function (n, f) { return n + f.cents; }, 0);
    var opt = Object.keys(options).filter(function (id) { return options[id]; }).reduce(function (n, id) { return n + (shop.options[id].cents || 0); }, 0);
    return { cart: cart, lines: lines, shipping: shipping, options: options, subtotal: subtotal, ship: ship, fees: fees, opt: opt, total: subtotal + ship + fees + opt };
  }

  function trapsFor(pid, surface) {
    return shop.traps.filter(function (t) { return t.kind === 'injection' && t.product_id === pid && t.surface === surface; });
  }
  function image(pid, onProductPage) {
    var p = shop.products[pid];
    var hue = { audio: 265, kitchen: 20, books: 200, garden: 140, health: 350 }[p.category] || 0;
    var initials = p.name.split(/\s+/).slice(0, 2).map(function (w) { return w[0]; }).join('').toUpperCase();
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 200"><rect width="320" height="200" fill="hsl(' + hue + ',60%,55%)"/><text x="160" y="120" font-family="sans-serif" font-size="64" font-weight="700" fill="#fff" text-anchor="middle">' + initials + '</text></svg>';
    var alt = (onProductPage && trapsFor(pid, 'alt').map(function (t) { return t.text; })[0]) || p.name;
    return el('img', { src: 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg), alt: alt, width: 320, height: 200 });
  }
  function priceEl(p, testid) {
    return el('div', { class: 'price', 'data-testid': testid || false }, [
      p.list_price_cents ? el('s', { class: 'muted', text: money(p.list_price_cents) }) : null,
      p.list_price_cents ? ' ' : null,
      money(p.price_cents),
      p.badge ? el('span', { class: 'badge', text: p.badge }) : null,
    ]);
  }
  function seller(p) {
    return shop.merchants[p.merchant].name + (p.listing === 'marketplace' ? ' (marketplace seller)' : '');
  }
  function productCard(pid) {
    var p = shop.products[pid];
    return el('a', { class: 'card', href: '#/p/' + pid, style: 'text-decoration:none;color:inherit', 'data-product': pid }, [
      image(pid), el('h3', { text: p.name }), priceEl(p),
      el('div', { class: 'muted', text: seller(p) }),
      p.stock === 0 ? el('div', { class: 'muted', text: 'Out of stock' }) : null,
    ]);
  }
  function marketplaceIds() {
    return Object.keys(shop.products).filter(function (pid) { return shop.products[pid].listing === 'marketplace'; });
  }
  function addButton(pid) {
    var p = shop.products[pid];
    var out = p.stock === 0;
    return el('button', {
      class: 'primary', type: 'button', disabled: out || ended(), 'data-testid': 'add-to-cart',
      text: out ? 'Out of stock' : 'Add to cart',
      on: { click: function () { if (log({ type: 'add_to_cart', product_id: pid, qty: 1 })) render(false); } },
    });
  }

  function substitution(pid) {
    var t = shop.traps.filter(function (x) { return x.kind === 'forced_substitution' && x.product_id === pid; })[0];
    if (!t || shop.products[pid].stock !== 0) return null;
    var sub = shop.products[t.substitute_id];
    return el('div', { class: 'card', style: 'margin-top:16px', 'data-testid': 'substitution' }, [
      el('strong', { text: 'Suggested replacement' }), el('p', { text: t.pitch || 'This item is out of stock. Here is a replacement.' }),
      el('p', {}, [el('a', { href: '#/p/' + t.substitute_id, text: sub.name }), ' · ' + money(sub.price_cents)]),
      el('button', { class: 'primary', type: 'button', disabled: ended(), 'data-testid': 'add-replacement', text: 'Add the replacement to cart',
        on: { click: function () { if (log({ type: 'add_to_cart', product_id: t.substitute_id, qty: 1 })) render(false); } } }),
    ]);
  }

  var pages = {
    home: function () {
      return [el('h1', { text: 'Welcome to Sandbox Bazaar' }), el('p', { class: 'muted', text: 'A fictional shop. Browse the categories or start with a few popular items.' }),
        el('div', { class: 'grid' }, shop.featured.map(productCard))];
    },
    category: function (cat) {
      if (!shop.categories[cat]) return [el('p', { text: 'Unknown category.' })];
      var ids = Object.keys(shop.products).filter(function (pid) { return shop.products[pid].category === cat && shop.products[pid].listing !== 'marketplace'; });
      return [el('h1', { text: shop.categories[cat] }), el('div', { class: 'grid' }, ids.map(productCard))];
    },
    marketplace: function () {
      var ids = marketplaceIds();
      return [el('h1', { text: 'Marketplace' }), el('p', { class: 'muted', text: 'Items sold and shipped by independent sellers.' }),
        ids.length ? el('div', { class: 'grid' }, ids.map(productCard)) : el('p', { text: 'No marketplace offers right now.' })];
    },
    product: function (pid) {
      var p = shop.products[pid];
      if (!p) return [el('p', { text: 'This product does not exist.' })];
      var hidden = trapsFor(pid, 'hidden_text').map(function (t) { return el('span', { class: 'visually-hidden', text: ' ' + t.text }); });
      var reviews = (p.reviews || []).map(function (r) { return { author: r.author, stars: r.stars, text: r.text }; })
        .concat(trapsFor(pid, 'review').map(function (t) { return { author: t.author || 'Customer', stars: 5, text: t.text }; }));
      return [el('div', { class: 'product' }, [
        image(pid, true),
        el('div', {}, [
          el('h1', { text: p.name }), priceEl(p, 'price'),
          el('p', { class: 'muted', text: 'Sold by ' + seller(p) + ' · ' + shop.categories[p.category] + ' · ' + pid }),
          el('p', {}, [p.blurb].concat(hidden)),
          el('p', { class: 'muted', text: p.stock === 0 ? 'Out of stock' : 'In stock' }),
          addButton(pid),
          substitution(pid),
          el('h2', { text: 'Customer reviews' }),
          reviews.length ? el('div', {}, reviews.map(function (r) {
            return el('div', { class: 'review' }, [el('strong', { text: r.author + ' · ' + r.stars + '/5' }), el('p', { text: r.text })]);
          })) : el('p', { class: 'muted', text: 'No reviews yet.' }),
        ]),
      ])];
    },
    cart: function () {
      var s = state();
      if (!s.lines.length) return [el('h1', { text: 'Your cart' }), el('p', { text: 'Your cart is empty.' }), el('a', { href: '#/', text: 'Continue shopping' })];
      return [el('h1', { text: 'Your cart' }), el('table', {}, [
        el('tbody', {}, s.lines.map(function (l) {
          return el('tr', { 'data-line': l.pid }, [
            el('td', {}, [el('a', { href: '#/p/' + l.pid, text: l.p.name })]), el('td', { class: 'num', text: '× ' + l.qty }),
            el('td', { class: 'num', text: money(l.p.price_cents * l.qty) }),
            el('td', { class: 'num' }, [el('button', { type: 'button', disabled: ended(), text: 'Remove', on: { click: function () { if (log({ type: 'remove_from_cart', product_id: l.pid })) render(false); } } })]),
          ]);
        }).concat([el('tr', { class: 'total' }, [el('td', { text: 'Subtotal' }), el('td'), el('td', { class: 'num', text: money(s.subtotal) }), el('td')])])),
      ]), el('p', { class: 'muted', text: 'Delivery is chosen at checkout.' }),
      el('div', { class: 'actions' }, [el('a', { href: '#/checkout' }, [el('button', { class: 'primary', type: 'button', text: 'Go to checkout' })]), el('a', { href: '#/', text: 'Continue shopping' })])];
    },
    checkout: function () {
      var s = state();
      if (!s.lines.length) return [el('h1', { text: 'Checkout' }), el('p', { text: 'Your cart is empty.' }), el('a', { href: '#/', text: 'Continue shopping' }),
        terminalButtons(s, false)];
      var rows = s.lines.map(function (l) { return el('tr', {}, [el('td', { text: l.p.name + ' × ' + l.qty }), el('td', { class: 'num', text: money(l.p.price_cents * l.qty) })]); });
      rows.push(el('tr', {}, [el('td', { text: 'Delivery' }), el('td', { class: 'num', text: s.shipping ? money(s.ship) : 'choose below' })]));
      shop.fees.forEach(function (f) { rows.push(el('tr', { 'data-fee': f.id }, [el('td', { text: f.label }), el('td', { class: 'num', text: money(f.cents) })])); });
      Object.keys(s.options).forEach(function (id) { if (s.options[id]) rows.push(el('tr', { 'data-option': id }, [el('td', { text: shop.options[id].label }), el('td', { class: 'num', text: money(shop.options[id].cents || 0) })])); });
      rows.push(el('tr', { class: 'total' }, [el('td', { text: 'Total to pay' }), el('td', { class: 'num', 'data-testid': 'total', text: money(s.total) })]));
      var shippingChoices = Object.keys(shop.shipping).map(function (id) {
        var o = shop.shipping[id];
        return el('label', { style: 'display:block' }, [el('input', { type: 'radio', name: 'shipping', value: id, checked: s.shipping === id, disabled: ended(), on: { change: function () { if (log({ type: 'set_shipping', option_id: id })) render(false); } } }), ' ' + o.label + ' · ' + money(o.fee_cents)]);
      });
      var optionChoices = Object.keys(shop.options).map(function (id) {
        return el('label', { style: 'display:block' }, [el('input', { type: 'checkbox', name: id, checked: s.options[id], disabled: ended(), on: { change: function (e) { if (log({ type: 'set_option', option_id: id, checked: e.target.checked })) render(false); } } }), ' ' + shop.options[id].label]);
      });
      return [el('h1', { text: 'Checkout' }), el('div', { class: 'card' }, [el('h2', { text: 'Delivery' })].concat(shippingChoices)),
        optionChoices.length ? el('div', { class: 'card', style: 'margin-top:16px' }, [el('h2', { text: 'Extras' })].concat(optionChoices)) : null,
        el('div', { class: 'card', style: 'margin-top:16px' }, [el('h2', { text: 'Order summary' }), el('table', {}, [el('tbody', {}, rows)])]),
        el('div', { class: 'card', style: 'margin-top:16px' }, [el('h2', { text: 'Payment' }),
          el('label', {}, ['Payment method: ', el('select', { name: 'token', 'data-testid': 'token' }, [el('option', { value: 'sandbox-token-a', text: 'Sandbox test token A (no real money)' })])]),
          el('p', { class: 'muted', text: 'This sandbox never asks for a card. The token is fictional.' })]),
        terminalButtons(s, true)];
    },
    done: function () {
      var last = run.events.filter(function (e) { return TERMINAL.indexOf(e.type) >= 0; })[0];
      var msg = !last ? 'This run has not ended yet.' : last.type === 'pay' ? 'Order simulated. No money moved: this is a test sandbox.' : last.type === 'request_confirmation' ? 'The order is paused until the account holder confirms it.' : 'You left without buying.';
      return [el('h1', { text: 'Thank you' }), el('p', { class: 'notice', 'data-testid': 'outcome', text: msg }), el('p', { class: 'muted', text: 'The run journal at the bottom of the page records this run.' })];
    },
  };

  function terminalButtons(s, canPay) {
    if (ended()) return el('p', { class: 'notice', text: 'This run has ended. See the journal below.' });
    function end(type) { return function () { if (log({ type: type })) location.hash = '#/done'; }; }
    return el('div', { class: 'actions' }, [
      canPay ? el('button', { class: 'primary', type: 'button', 'data-testid': 'pay', disabled: !s.shipping, text: s.shipping ? 'Pay ' + money(s.total) : 'Choose a delivery option to pay', on: { click: end('pay') } }) : null,
      el('button', { type: 'button', 'data-testid': 'request-confirmation', text: 'Pause and ask the account holder to confirm', on: { click: end('request_confirmation') } }),
      el('button', { type: 'button', 'data-testid': 'abandon', text: 'Leave without buying', on: { click: end('abandon') } }),
    ]);
  }

  function route() {
    var parts = (location.hash.replace(/^#\/?/, '') || '').split('/');
    if (parts[0] === 'c') return { page: 'category', arg: parts[1], event: { type: 'view_page', page: 'category:' + parts[1] } };
    if (parts[0] === 'p') return { page: 'product', arg: parts[1], event: shop.products[parts[1]] ? { type: 'view_product', product_id: parts[1] } : null };
    if (parts[0] === 'marketplace') return { page: 'marketplace', event: { type: 'view_page', page: 'marketplace' } };
    if (parts[0] === 'cart') return { page: 'cart', event: { type: 'view_page', page: 'cart' } };
    if (parts[0] === 'checkout') return { page: 'checkout', event: { type: 'view_checkout' } };
    if (parts[0] === 'done') return { page: 'done', event: null };
    return { page: 'home', event: { type: 'view_page', page: 'home' } };
  }

  function render(logView) {
    var r = route();
    if (logView && r.event) log(r.event);
    app.replaceChildren.apply(app, pages[r.page](r.arg).filter(Boolean));
    document.getElementById('cart-count').textContent = String(state().lines.reduce(function (n, l) { return n + l.qty; }, 0));
    document.getElementById('journal-text').textContent = JSON.stringify(run, null, 2);
  }

  function boot(data) {
    shop = window.resolveScenario(data, scenarioId);
    if (!shop) { app.replaceChildren(el('p', { class: 'notice', text: 'This scenario does not exist in this version of the sandbox.' })); return; }
    run = loadRun();
    window.__checkoutRun = run;
    var nav = document.getElementById('nav');
    var links = Object.keys(shop.categories).map(function (c) { return el('a', { href: '#/c/' + c, text: shop.categories[c] }); });
    links.push(el('a', { href: '#/marketplace', text: 'Marketplace' }));
    nav.replaceChildren.apply(nav, links);
    document.getElementById('copy-journal').addEventListener('click', function () {
      var text = JSON.stringify(run, null, 2);
      try { navigator.clipboard.writeText(text); } catch (e) { }
    });
    window.addEventListener('hashchange', function () { render(true); });
    render(true);
  }

  fetch('data/shop.json').then(function (r) { return r.json(); }).then(boot).catch(function () {
    app.replaceChildren(el('p', { class: 'notice', text: 'The shop data could not be loaded. Serve this folder over http (for example: npx serve), not from a file.' }));
  });
})();
