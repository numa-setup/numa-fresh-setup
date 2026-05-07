import { io } from 'socket.io-client';
const [,, ATOKEN, OTOKEN, CTOKEN] = process.argv;
const STORE_ID = '76c159e2-0dea-43ce-8dec-16b3e4276c8a';
const URL = 'http://localhost:8080';

const adminSocket = io(`${URL}/admin`, { auth: { token: ATOKEN } });
const storeSocket = io(`${URL}/store`, { auth: { token: OTOKEN } });

let received = { admin: 0, store: 0 };

adminSocket.on('connect', () => console.log('[admin] connected', adminSocket.id));
adminSocket.on('connect_error', (e) => console.log('[admin] connect_error:', e.message));
adminSocket.onAny((evt, ...args) => console.log('[admin] EVENT:', evt));
adminSocket.on('new_order', (d) => { received.admin++; console.log('[admin] >>> new_order received:', d.orderNumber); });

storeSocket.on('connect', () => console.log('[store] connected', storeSocket.id));
storeSocket.on('connect_error', (e) => console.log('[store] connect_error:', e.message));
storeSocket.onAny((evt, ...args) => console.log('[store] EVENT:', evt));
storeSocket.on('new_order', (d) => { received.store++; console.log('[store] >>> new_order received:', d.orderNumber); });

await new Promise(r => setTimeout(r, 2500));
console.log('--- placing order ---');
const r = await fetch(`${URL}/api/orders`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${CTOKEN}` },
  body: JSON.stringify({
    storeId: STORE_ID,
    orderType: 'EXPRESS_PICKUP',
    items: [{ productId: '72582bdf-100f-4eca-9d06-8fbb9980e85c', quantity: 1, substitutionPref: 'NO_REPLACEMENT' }],
  }),
});
console.log('[rest] status:', r.status, '| order:', (await r.json()).orderNumber);
await new Promise(r => setTimeout(r, 2500));
console.log('--- final --- admin:', received.admin, 'store:', received.store);
process.exit(0);
