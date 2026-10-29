// Azure Function (Node.js) - POST /api/contact
// Sends website form submissions by email using Azure Communication Services.
// Settings (Azure portal > Static Web App > Environment variables):
//   ACS_CONNECTION_STRING  - connection string of the Communication Services resource
//   MAIL_FROM              - sender on the verified custom domain (SPF + DKIM), e.g. DoNotReply@optimum-ksa.com
//   MAIL_TO                - recipient, for now info@optimum-ksa.com
//   TURNSTILE_SECRET       - optional Cloudflare Turnstile secret; when set, a valid token is required
//                            (set SITEKEY in js/form.js at the same time)
const { EmailClient } = require('@azure/communication-email');

const TRUSTED = 'Trusted Verification Service';
const TS_FIELD = 'cf-turnstile-response';

// Best-effort per-IP rate limit. Memory is per function instance, so this slows
// down a single sender rather than giving a hard global cap.
const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const hits = new Map();

function clientIp(req) {
  const h = req.headers || {};
  const raw = h['x-azure-clientip'] || h['x-forwarded-for'] || h['x-client-ip'] || '';
  return String(raw).split(',')[0].trim().replace(/:\d+$/, '') || 'unknown';
}

function limited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 5000) for (const [k, v] of hits) if (now - v[v.length - 1] >= WINDOW_MS) hits.delete(k);
  return recent.length > MAX_PER_WINDOW;
}

async function turnstileOk(token, ip) {
  if (!token) return false;
  const body = new URLSearchParams({ secret: process.env.TURNSTILE_SECRET, response: token });
  if (ip !== 'unknown') body.set('remoteip', ip);
  try {
    const r = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body });
    return (await r.json()).success === true;
  } catch (e) {
    return false;
  }
}
const REQUIRED = ['your-name', 'your-email', 'your-phone', 'area-of-interest'];

const LABELS = {
  'form_name': 'Form',
  'your-role': 'Role',
  'area-of-interest': 'Area of Interest',
  'verification-type': 'Verification Type',
  'your-name': 'Full Name',
  'your-organization': 'Organization / Institution',
  'your-email': 'Email',
  'your-phone': 'Contact Number',
  'your-country': 'Country',
  'your-message': 'Message',
  'page_language': 'Page Language',
  'page_url': 'Page URL'
};

function reply(context, status, body) {
  context.res = { status, headers: { 'Content-Type': 'application/json' }, body };
}

function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/\n/g, '<br>');
}

module.exports = async function (context, req) {
  const fields = req.body && typeof req.body === 'object' ? req.body : null;
  if (!fields || Array.isArray(fields)) return reply(context, 400, { error: 'Invalid request.' });

  // Honeypot filled in = bot. Pretend success so bots don't retry.
  if (fields.website) return reply(context, 200, { success: true });

  const ip = clientIp(req);
  if (limited(ip)) return reply(context, 429, { error: 'Too many requests. Please try again later.' });

  if (process.env.TURNSTILE_SECRET && !(await turnstileOk(String(fields[TS_FIELD] || ''), ip))) {
    return reply(context, 403, { error: 'Verification failed. Please try again.' });
  }
  delete fields[TS_FIELD];

  const missing = REQUIRED.filter((f) => !String(fields[f] || '').trim());
  if (missing.length) return reply(context, 400, { error: 'Missing required fields: ' + missing.join(', ') });

  const email = String(fields['your-email']).trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return reply(context, 400, { error: 'Invalid email address.' });

  if (fields['area-of-interest'] === TRUSTED && !String(fields['verification-type'] || '').trim()) {
    return reply(context, 400, { error: 'Verification Type is required.' });
  }

  const { ACS_CONNECTION_STRING, MAIL_FROM, MAIL_TO } = process.env;
  if (!ACS_CONNECTION_STRING || !MAIL_FROM || !MAIL_TO) {
    context.log.error('Missing ACS_CONNECTION_STRING / MAIL_FROM / MAIL_TO settings');
    return reply(context, 500, { error: 'Email service is not configured.' });
  }

  const order = Object.keys(LABELS);
  const keys = Object.keys(fields)
    .filter((k) => k !== 'website' && String(fields[k] || '').trim())
    .sort((a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99));

  const rows = keys.map((k) =>
    '<tr><th style="text-align:left;padding:8px 12px;border:1px solid #ddd;background:#f5f7f5;white-space:nowrap">' +
    esc(LABELS[k] || k) + '</th><td style="padding:8px 12px;border:1px solid #ddd">' + esc(fields[k]) + '</td></tr>'
  ).join('');

  const area = String(fields['area-of-interest']);
  const type = String(fields['verification-type'] || '').trim();
  const subject = 'New enquiry - ' + String(fields.form_name || 'Website') + ' - ' + area + (type ? ' (' + type + ')' : '');

  try {
    const client = new EmailClient(ACS_CONNECTION_STRING);
    const poller = await client.beginSend({
      senderAddress: MAIL_FROM,
      content: {
        subject,
        html: '<h2 style="font-family:Arial,sans-serif;color:#18301D">New website enquiry</h2>' +
              '<table style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:14px">' + rows + '</table>',
        plainText: keys.map((k) => (LABELS[k] || k) + ': ' + fields[k]).join('\n')
      },
      recipients: { to: MAIL_TO.split(',').map((a) => ({ address: a.trim() })) },
      replyTo: [{ address: email, displayName: String(fields['your-name']).trim() }]
    });
    await poller.pollUntilDone();
    return reply(context, 200, { success: true });
  } catch (err) {
    context.log.error('ACS send failed', err && err.message);
    return reply(context, 502, { error: 'Email delivery failed.' });
  }
};
