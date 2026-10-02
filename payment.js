(function () {
  'use strict';

  const API = 'https://bodibedigital-backend.onrender.com';
  const details = document.getElementById('paymentDetails');
  const status = document.getElementById('paymentStatus');
  const actions = document.getElementById('paymentActions');
  const unavailable = document.getElementById('paymentUnavailable');
  const pay = document.getElementById('payYoco');
  const refresh = document.getElementById('refreshPayment');
  const modeBanner = document.getElementById('paymentMode');
  const partField = document.getElementById('paymentPartField');
  const depositLabel = document.getElementById('depositLabel');
  const balanceLabel = document.getElementById('balanceLabel');
  const hash = new URLSearchParams(location.hash.slice(1));
  const query = new URLSearchParams(location.search);

  const urlToken = hash.get('token') || query.get('token') || '';
  const urlPayment = hash.get('payment') || query.get('payment') || '';
  const token = urlToken || sessionStorage.getItem('bodibe.invoiceAccess') || '';
  const paymentId = urlPayment || sessionStorage.getItem('bodibe.paymentId') || '';

  if (urlToken) sessionStorage.setItem('bodibe.invoiceAccess', urlToken);
  if (urlPayment) sessionStorage.setItem('bodibe.paymentId', urlPayment);

  // Keep sensitive access grants out of the visible address bar after we have
  // safely cached them for this browser session.
  if (urlToken) {
    const clean = new URL(location.href);
    clean.searchParams.delete('token');
    const cleanHash = new URLSearchParams(clean.hash.slice(1));
    cleanHash.delete('token');
    if (urlPayment) cleanHash.set('payment', urlPayment);
    clean.hash = cleanHash.toString();
    history.replaceState(null, '', clean.pathname + clean.search + (clean.hash ? '#' + clean.hash.slice(1) : ''));
  }

  const money = (n) => new Intl.NumberFormat('en-ZA', {
    style: 'currency', currency: 'ZAR', minimumFractionDigits: 2
  }).format(Number(n || 0));

  function el(tag, className, value) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (value !== undefined) node.textContent = value;
    return node;
  }

  function showStatus(message, type) {
    status.textContent = message || '';
    status.className = 'payment-status' + (type ? ' ' + type : '');
    status.hidden = !message;
  }

  function setUnavailable(message) {
    actions.hidden = true;
    unavailable.hidden = false;
    if (message) {
      const p = unavailable.querySelector('p');
      if (p) p.textContent = message;
    }
  }

  async function request(path, body) {
    const response = await fetch(API + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: token, ...(body || {}) })
    });

    let payload;
    try {
      payload = await response.json();
    } catch (_) {
      throw Error('The payment service is temporarily unavailable. Please contact Bodibe Digital before paying again.');
    }

    if (!response.ok || !payload.success) {
      throw Error(payload.message || 'Unable to check this payment.');
    }
    return payload;
  }

  function renderInvoice(invoice) {
    details.replaceChildren();
    details.className = '';

    const invoiceId = el('p', 'invoice-id', 'Invoice ' + invoice.invoiceId);
    const client = el('p', 'client-name', invoice.clientName || 'Client');
    const dl = el('dl', 'invoice-breakdown');

    const rows = [
      ['Invoice total', invoice.total, 'total'],
      ['Confirmed paid', invoice.amountPaid, ''],
      ['Outstanding', invoice.balanceDue, 'outstanding']
    ];

    rows.forEach(([label, value, cls]) => {
      const wrap = el('div', 'invoice-row' + (cls ? ' ' + cls : ''));
      wrap.append(el('dt', '', label), el('dd', '', money(value)));
      dl.append(wrap);
    });

    details.append(invoiceId, client, dl);
  }

  function renderMode(mode) {
    modeBanner.hidden = false;
    if (mode === 'live') {
      modeBanner.className = 'mode-banner live';
      modeBanner.textContent = 'LIVE SECURE PAYMENT — successful Yoco payments update your invoice automatically.';
    } else {
      modeBanner.className = 'mode-banner';
      modeBanner.textContent = 'TEST CHECKOUT — no real money is charged and business records remain unchanged.';
    }
  }

  function selectedPart() {
    const picked = document.querySelector('input[name="paymentPart"]:checked');
    return picked ? picked.value : 'balance';
  }

  async function load() {
    refresh.disabled = true;
    unavailable.hidden = true;
    showStatus('');

    try {
      if (!token) {
        setUnavailable('Open the latest official payment link supplied with your invoice. Payment return links are not reusable without that secure invoice access.');
        throw Error('Payment link unavailable or expired.');
      }

      const result = await request('/payments/yoco/invoice');
      const invoice = result.invoice;
      renderInvoice(invoice);
      renderMode(result.mode);

      document.getElementById('eftInstructions').textContent = result.eftInstructions || '';
      actions.hidden = invoice.balanceDue <= 0;

      const canPayDeposit = invoice.depositOutstanding >= 2 && invoice.depositOutstanding < invoice.balanceDue;
      partField.hidden = !canPayDeposit;
      if (canPayDeposit) {
        depositLabel.textContent = 'Required deposit · ' + money(invoice.depositOutstanding);
        balanceLabel.textContent = 'Outstanding balance · ' + money(invoice.balanceDue);
      } else {
        const balanceRadio = document.querySelector('input[name="paymentPart"][value="balance"]');
        if (balanceRadio) balanceRadio.checked = true;
      }

      if (invoice.balanceDue <= 0) {
        showStatus('This invoice is fully paid. Thank you.', 'success');
        return;
      }

      if (paymentId) {
        const payment = await request('/payments/yoco/status', { paymentId: paymentId });
        if (payment.status === 'Paid') {
          showStatus('Payment received and confirmed. Thank you.', 'success');
          actions.hidden = true;
        } else if (payment.status === 'Test Paid') {
          showStatus('Test payment confirmed. No real money was charged and your real invoice was not changed.', 'success');
          actions.hidden = true;
        } else if (payment.status === 'Failed') {
          showStatus('That payment attempt was unsuccessful. You may try again or use EFT.', 'error');
          actions.hidden = false;
        } else if (payment.status === 'Review Required') {
          showStatus('This payment requires Finance review. Please do not make another payment.', 'error');
          actions.hidden = true;
        } else {
          showStatus('Your payment is being confirmed. Please do not make another payment yet.');
          actions.hidden = true;
        }
      }
    } catch (error) {
      if (!details.querySelector('.invoice-breakdown')) {
        details.replaceChildren(el('p', 'invoice-id', 'Secure invoice access required'));
      }
      if (!status.textContent) showStatus(error.message, 'error');
      if (!token) setUnavailable();
    } finally {
      details.removeAttribute('aria-busy');
      refresh.disabled = false;
    }
  }

  pay.addEventListener('click', async function () {
    pay.disabled = true;
    showStatus('Preparing your secure Yoco checkout…');

    try {
      const result = await request('/payments/yoco/checkout', { part: selectedPart() });
      const checkout = new URL(result.checkoutUrl);
      const allowed = ['c.yoco.com', 'payments.yoco.com'];
      if (checkout.protocol !== 'https:' || !allowed.includes(checkout.hostname) || checkout.username || checkout.password || checkout.port) {
        throw Error('The checkout link could not be verified. Please contact Bodibe Digital.');
      }
      sessionStorage.setItem('bodibe.paymentId', result.paymentId);
      location.assign(checkout.href);
    } catch (error) {
      showStatus(error.message, 'error');
      pay.disabled = false;
    }
  });

  refresh.addEventListener('click', load);
  load();
})();
