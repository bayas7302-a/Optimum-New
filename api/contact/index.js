// Azure Function (Node.js) - POST /api/contact
// Sends website form submissions by email using Azure Communication Services.
// Settings (Azure portal > Static Web App > Environment variables):
//   ACS_CONNECTION_STRING  - connection string of the Communication Services resource
//   MAIL_FROM              - verified sender, e.g. DoNotReply@xxxx.azurecomm.net
//   MAIL_TO                - recipient, for now info@optimum-ksa.com
const { EmailClient } = require('@azure/communication-email');

const TRUSTED = 'Trusted Verification Service';
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
