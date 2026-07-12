```javascript
const WebSocket = require('ws');
const fetch = require('node-fetch');

// ===== CONFIG =====
const DERIV_APP_ID = 'YOUR_APP_ID';
const DERIV_TOKEN = 'YOUR_DERIV_TOKEN';
const SYMBOL = 'R_100';
const RSI_PERIOD = 14;
const BUY_THRESHOLD = 30;
const SELL_THRESHOLD = 70;

// Notification — pick one
const NOTIFY = 'whatsapp'; // 'whatsapp' or 'email'

// WhatsApp (WPSent)
const WP_CLIENT_ID = 'cid_xxx';
const WP_SECRET = 'your_secret';
const WP_PHONE = '+254795104585';

// Email (SendGrid)
const SG_API_KEY = 'SG.xxxxx';
const FROM_EMAIL = 'ianmunene1417@gmail.com';
const TO_EMAIL = 'ianmunene1417@gmail.com';
// ===== END CONFIG =====

function calcRSI(prices) {
  if (prices.length < RSI_PERIOD + 1) return null;
  let gains = 0, losses = 0;
  for (let i = prices.length - RSI_PERIOD; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff > 0) gains += diff; else losses -= diff;
  }
  const avgGain = gains / RSI_PERIOD;
  const avgLoss = losses / RSI_PERIOD;
  if (avgLoss === 0) return 100;
  return 100 - (100 / (1 + avgGain / avgLoss));
}

async function sendNotif(msg) {
  if (NOTIFY === 'whatsapp') {
    const url = https://wpsent.xyz/send?clientid=${WP_CLIENT_ID}&key=${WP_SECRET}&to=${WP_PHONE};
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg })
    });
    const data = await res.json();
    if (!data.ok) console.error('WhatsApp failed:', data);
    else console.log('✅ WhatsApp sent');
  } else if (NOTIFY === 'email') {
    const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': Bearer ${SG_API_KEY},
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: TO_EMAIL }] }],
        from: { email: FROM_EMAIL },
        subject: 'Deriv Signal Alert',
        content: [{ type: 'text/plain', value: msg }]
      })
    });
    if (!res.ok) console.error('Email failed:', await res.text());
    else console.log('✅ Email sent');
  }
}

async function main() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(wss://ws.derivws.com/websockets/v3?app_id=${DERIV_APP_ID});

    ws.on('open', () => {
      ws.send(JSON.stringify({ authorize: DERIV_TOKEN }));
      ws.send(JSON.stringify({
        ticks_history: SYMBOL,
        adjust_start_time: 1,
        end: 'latest',
        start: Math.floor(Date.now() / 1000) - 600, // last 10 min
        style: 'ticks',
        count: 100
      }));
    });

    ws.on('message', async (data) => {
      const msg = JSON.parse(data);

      // Skip auth response
      if (msg.msg_type === 'authorize') return;

      if (msg.msg_type === 'history') {
        const prices = msg.history.prices.map(Number);
        console.log(Got ${prices.length} ticks);

        const rsi = calcRSI(prices);
        if (rsi === null) {
          console.log('Not enough data yet');
          resolve();
          ws.close();
          return;
        }

        const latestPrice = prices[prices.length - 1];
        console.log(RSI: ${rsi.toFixed(2)}, Price: ${latestPrice});let signal = 'HOLD';
        if (rsi < BUY_THRESHOLD) signal = 'BUY (CALL)';
        else if (rsi > SELL_THRESHOLD) signal = 'SELL (PUT)';

        if (signal !== 'HOLD') {
          const timestamp = new Date().toLocaleString();
          const emoji = signal.includes('BUY') ? '🟢' : '🔴';
          const alertMsg = ${emoji} Deriv Signal: ${signal}\nRSI: ${rsi.toFixed(2)}\nPrice: ${latestPrice}\nSymbol: ${SYMBOL}\nTime: ${timestamp};
          await sendNotif(alertMsg);
          console.log(alertMsg);
        } else {
          console.log('No signal — RSI neutral');
        }

        resolve();
        ws.close();
      }
    });

    ws.on('error', (err) => {
      console.error('WS error:', err);
      reject(err);
    });

    setTimeout(() => {
      console.log('⏱ Timeout — closing');
      ws.close();
      resolve();
    }, 15000);
  });
}

main().catch(e => {
  console.error('❌ Fatal:', e);
  process.exit(1);
});
