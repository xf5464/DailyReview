const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const SENDERS = {
  email: 'send-forecast-email.js',
  wecom: 'send-wechat-alert.js',
  bark: 'send-bark-alert.js',
};

function conditionKey(condition) {
  return JSON.stringify([condition.id, condition.threshold, condition.episodeStart]);
}

function readState(file) {
  if (!fs.existsSync(file)) return { version: 2, channels: {} };
  const state = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (state.version !== 2 || !state.channels || typeof state.channels !== 'object') {
    throw new Error('Invalid forecast delivery state');
  }
  return state;
}

function pendingConditions(alert, state, channel) {
  const delivered = new Set(state.channels[channel] || []);
  return (alert.conditions || []).filter(condition => {
    // Migration: this exact gold observation was already delivered by v1 (2026-11-20).
    // Preserve its episode only; a new observation, threshold or episode can notify.
    const legacyGold = condition.id === 'centralBankGoldPurchases'
      && condition.date === '2026-09-30' && condition.threshold === 25;
    return !legacyGold && !delivered.has(conditionKey(condition));
  });
}

function deliver(channel, { directory = process.cwd(), env = process.env, send } = {}) {
  if (!SENDERS[channel]) throw new Error(`Unknown forecast notification channel: ${channel}`);
  const alertPath = path.join(directory, '.forecast-alert.json');
  const original = fs.readFileSync(alertPath, 'utf8');
  const alert = JSON.parse(original);
  const statePath = path.join(directory, '.forecast-delivery', 'state.json');
  const forceTest = String(env.FORCE_NOTIFICATION_TEST || '').toLowerCase() === 'true';
  const state = readState(statePath);
  const pending = forceTest ? alert.conditions || [] : pendingConditions(alert, state, channel);
  if (!forceTest && !pending.length) {
    console.log(`No new forecast conditions for ${channel}; notification skipped.`);
    return [];
  }
  const filtered = { ...alert, conditions: pending, shouldNotify: pending.length > 0 };
  try {
    fs.writeFileSync(alertPath, JSON.stringify(filtered));
    (send || (() => execFileSync(process.execPath, [path.join(__dirname, SENDERS[channel])], {
      cwd: directory, env, stdio: 'inherit',
    })))();
    // Only record confirmed successful delivery. Test sends never change production state.
    if (!forceTest) {
      state.channels[channel] = [...new Set([
        ...(state.channels[channel] || []), ...pending.map(conditionKey),
      ])];
      fs.mkdirSync(path.dirname(statePath), { recursive: true });
      const temporary = `${statePath}.tmp`;
      fs.writeFileSync(temporary, `${JSON.stringify(state, null, 2)}\n`);
      fs.renameSync(temporary, statePath);
    }
  } finally {
    fs.writeFileSync(alertPath, original);
  }
  return pending;
}

if (require.main === module) {
  try { deliver(process.argv[2]); }
  catch (error) { console.error(error); process.exitCode = 1; }
}
module.exports = { conditionKey, pendingConditions, deliver };
