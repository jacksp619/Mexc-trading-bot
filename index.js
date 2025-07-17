const axios = require('axios');
const crypto = require('crypto');

const API_KEY = process.env.MEXC_API_KEY;
const API_SECRET = process.env.MEXC_API_SECRET;
const BASE_URL = 'https://contract.mexc.com';

const SYMBOL = 'BTC_USDT';
const LEVERAGE = 50;
const TP = 0.05; // 5% Take Profit
const SL = 0.02; // 2% Stop Loss

async function fetchPrice() {
  try {
    const res = await axios.get(`${BASE_URL}/api/v1/contract/ticker?symbol=${SYMBOL}`);
    const price = parseFloat(res.data.data.lastPrice || res.data.data.last_price);
    console.log(`Market price: ${price}`);
    return price;
  } catch (err) {
    console.error('Error fetching price:', err.response?.data || err.message);
    return null;
  }
}

function signRequest(method, path, timestamp, body = '') {
  const prehash = `${method}${path}${timestamp}${body}`;
  return crypto
    .createHmac('sha256', API_SECRET)
    .update(prehash)
    .digest('hex');
}

async function getUSDTBalance() {
  const timestamp = Date.now().toString();
  const path = '/api/v1/private/account/assets';
  const signature = signRequest('GET', path, timestamp);
  
  try {
    const res = await axios.get(BASE_URL + path, {
      headers: {
        ApiKey: API_KEY,
        'Request-Time': timestamp,
        Signature: signature,
      },
    });
    const usdt = res.data.data.find(a => a.currency === 'USDT');
    return parseFloat(usdt.availableBalance || usdt.available_balance);
  } catch (err) {
    console.error('Error fetching balance:', err.response?.data || err.message);
    return null;
  }
}

async function placeOrder(price, qty) {
  const timestamp = Date.now().toString();
  const path = '/api/v1/private/order/submit';
  const payload = {
    symbol: SYMBOL,
    price: price.toFixed(2),
    vol: qty,
    leverage: LEVERAGE,
    side: 1,
    type: 1,
    open_type: 1,
    position_id: 0,
    external_oid: `node-bot-${Date.now()}`,
    stop_loss_price: (price * (1 - SL)).toFixed(2),
    take_profit_price: (price * (1 + TP)).toFixed(2),
    position_mode: 1,
  };

  const body = Object.entries(payload)
    .sort()
    .map(([k, v]) => `${k}=${v}`)
    .join('&');

  const signature = signRequest('POST', path, timestamp, body);

  try {
    const res = await axios.post(BASE_URL + path, body, {
      headers: {
        ApiKey: API_KEY,
        'Request-Time': timestamp,
        Signature: signature,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    console.log('Order response:', res.data);
  } catch (err) {
    console.error('Error placing order:', err.response?.data || err.message);
  }
}

async function runBot() {
  const price = await fetchPrice();
  const balance = await getUSDTBalance();

  if (!price || !balance) {
    console.log('Missing price or balance');
    return;
  }

  const qty = (balance / price).toFixed(3);
  console.log(`Placing order with qty: ${qty} at price: ${price}`);
  await placeOrder(price, qty);
}

runBot();