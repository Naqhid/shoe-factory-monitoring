const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

const transporter = nodemailer.createTransport({
  host: 'smtp-relay.brevo.com',
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

const ALERT_EMAIL = process.env.ALERT_EMAIL || 'sysgridz@gmail.com';

const SEVERITY_EMOJI = { critical: '🔴', warning: '🟡', info: '🔵' };
const TYPE_LABEL = {
  efficiency_low: 'Low Efficiency',
  headcount_low:  'Low Headcount',
  machine_idle:   'Machine Idle',
  target_at_risk: 'Target at Risk',
  custom:         'Alert',
};

/**
 * Send a single alert email
 */
async function sendAlertEmail(alert) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    logger.warn('Email not configured — skipping alert email');
    return;
  }

  const emoji   = SEVERITY_EMOJI[alert.severity] || '⚠️';
  const label   = TYPE_LABEL[alert.alert_type]   || 'Alert';
  const subject = `${emoji} ProdPulse ${label} — ${alert.alert_date}`;

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
      <div style="background:${alert.severity === 'critical' ? '#dc2626' : '#f59e0b'};padding:16px 24px">
        <h2 style="color:#fff;margin:0">${emoji} ${label}</h2>
        <p style="color:#fff;margin:4px 0 0;font-size:13px">${alert.alert_date}</p>
      </div>
      <div style="padding:24px">
        <p style="font-size:16px;color:#111827;margin:0 0 16px">${alert.message}</p>
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          ${alert.work_centre_name ? `<tr><td style="padding:6px 0;color:#6b7280">Work Centre</td><td style="padding:6px 0;font-weight:600">${alert.work_centre_name}</td></tr>` : ''}
          ${alert.machine_id       ? `<tr><td style="padding:6px 0;color:#6b7280">Machine ID</td><td style="padding:6px 0;font-weight:600">${alert.machine_id}</td></tr>` : ''}
          ${alert.actual_value != null ? `<tr><td style="padding:6px 0;color:#6b7280">Actual Value</td><td style="padding:6px 0;font-weight:600">${alert.actual_value}</td></tr>` : ''}
          ${alert.threshold_value != null ? `<tr><td style="padding:6px 0;color:#6b7280">Threshold</td><td style="padding:6px 0;font-weight:600">${alert.threshold_value}</td></tr>` : ''}
        </table>
      </div>
      <div style="background:#f9fafb;padding:12px 24px;font-size:12px;color:#9ca3af">
        ProdPulse — Smart Production Tracking System
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"ProdPulse Alerts" <${process.env.EMAIL_USER}>`,
      to: ALERT_EMAIL,
      subject,
      html,
    });
    logger.info(`Alert email sent to ${ALERT_EMAIL}: ${subject}`);
  } catch (err) {
    logger.error('Failed to send alert email:', err);
    throw err;
  }
}

/**
 * Send a digest of multiple alerts
 */
async function sendAlertDigest(alerts, date) {
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    logger.warn('Email not configured — skipping digest email');
    return;
  }
  if (!alerts || alerts.length === 0) return;

  const criticals = alerts.filter(a => a.severity === 'critical').length;
  const warnings  = alerts.filter(a => a.severity === 'warning').length;

  const rows = alerts.map(a => {
    const emoji = SEVERITY_EMOJI[a.severity] || '⚠️';
    const label = TYPE_LABEL[a.alert_type]   || 'Alert';
    return `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb">${emoji} ${label}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb">${a.message}</td>
      </tr>`;
  }).join('');

  const html = `
    <div style="font-family:Arial,sans-serif;max-width:700px;margin:auto;border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
      <div style="background:#1d4ed8;padding:16px 24px">
        <h2 style="color:#fff;margin:0">📊 ProdPulse Alert Digest — ${date}</h2>
        <p style="color:#bfdbfe;margin:4px 0 0;font-size:13px">
          ${criticals} critical &nbsp;|&nbsp; ${warnings} warnings
        </p>
      </div>
      <div style="padding:24px">
        <table style="width:100%;border-collapse:collapse;font-size:14px">
          <thead>
            <tr style="background:#f3f4f6">
              <th style="padding:8px;text-align:left;color:#374151">Type</th>
              <th style="padding:8px;text-align:left;color:#374151">Message</th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      <div style="background:#f9fafb;padding:12px 24px;font-size:12px;color:#9ca3af">
        ProdPulse — Smart Production Tracking System
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"ProdPulse Alerts" <${process.env.EMAIL_USER}>`,
      to: ALERT_EMAIL,
      subject: `📊 ProdPulse Alert Digest — ${date} (${alerts.length} alerts)`,
      html,
    });
    logger.info(`Alert digest sent to ${ALERT_EMAIL}: ${alerts.length} alerts`);
  } catch (err) {
    logger.error('Failed to send alert digest:', err);
    throw err;
  }
}

module.exports = { sendAlertEmail, sendAlertDigest };
