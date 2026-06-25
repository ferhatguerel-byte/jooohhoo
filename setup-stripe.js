// Dieses Script einmal ausführen: node setup-stripe.js
// Erstellt alle Stripe-Produkte und gibt die Price-IDs aus
// Vorher: STRIPE_SECRET_KEY als Umgebungsvariable setzen
// Windows: set STRIPE_SECRET_KEY=sk_test_... && node setup-stripe.js
// Mac/Linux: STRIPE_SECRET_KEY=sk_test_... node setup-stripe.js

const https = require('https');

const SECRET_KEY = process.env.STRIPE_SECRET_KEY;
if (!SECRET_KEY) {
  console.error('Fehler: STRIPE_SECRET_KEY Umgebungsvariable nicht gesetzt!');
  console.error('Windows: set STRIPE_SECRET_KEY=sk_test_... && node setup-stripe.js');
  process.exit(1);
}

function post(path, data) {
  return new Promise((resolve, reject) => {
    const body = new URLSearchParams(data).toString();
    const req = https.request({
      hostname: 'api.stripe.com',
      path,
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SECRET_KEY}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(body),
      },
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => resolve(JSON.parse(d)));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

async function main() {
  console.log('Erstelle Stripe-Produkte...\n');

  const plans = [
    { name: 'Starter', amount: 2900, env: 'STRIPE_PRICE_STARTER' },
    { name: 'Pro', amount: 7900, env: 'STRIPE_PRICE_PRO' },
    { name: 'Enterprise', amount: 19900, env: 'STRIPE_PRICE_ENTERPRISE' },
  ];

  console.log('Trage diese Zeilen in deine Vercel Umgebungsvariablen ein:\n');

  for (const plan of plans) {
    const product = await post('/v1/products', { name: `AutoBusiness Pro - ${plan.name}` });
    const price = await post('/v1/prices', {
      product: product.id,
      unit_amount: plan.amount,
      currency: 'eur',
      'recurring[interval]': 'month',
    });
    console.log(`${plan.env}=${price.id}`);
  }

  console.log('\nFertig!');
}

main().catch(console.error);
