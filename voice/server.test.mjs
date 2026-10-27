import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import net from 'node:net';
import twilio from 'twilio';
import { isPhoneNumber } from './support.mjs';

test('staff transfer accepts E.164 numbers and rejects malformed or injected destinations', () => {
  assert.equal(isPhoneNumber('+14165550123'), true);
  for (const value of ['4165550123', '+0123456789', '+1', '+14165550123</Dial>', '+141655501234567890']) assert.equal(isPhoneNumber(value), false);
});

test('phone webhook rejects unsigned calls and accepts only correctly signed requests', async () => {
  const listener = net.createServer();
  listener.listen(0, '127.0.0.1');
  await once(listener, 'listening');
  const port = listener.address().port;
  await new Promise(resolve => listener.close(resolve));
  const origin = `http://127.0.0.1:${port}`;
  const secret = 'test-signature-secret';
  const child = spawn(process.execPath, ['server.mjs'], { cwd: import.meta.dirname, env: {
    ...process.env, VOICE_SERVER_PORT: String(port), VOICE_PUBLIC_BASE_URL: origin,
    VOICE_STREAM_URL: 'wss://voice.example.test/media', VOICE_VALIDATE_TWILIO: '1',
    TWILIO_AUTH_TOKEN: secret, OPENAI_API_KEY: 'test-only-no-network',
  }, stdio: ['ignore', 'pipe', 'pipe'] });
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Voice server did not start')), 10000);
      child.stdout.on('data', chunk => { if (chunk.toString().includes('listening')) { clearTimeout(timer); resolve(); } });
      child.once('error', reject);
      child.once('exit', code => { clearTimeout(timer); reject(new Error(`Voice server exited: ${code}`)); });
    });
    const health = await (await fetch(origin + '/health')).json();
    assert.equal(health.service, 'bioverse-counselling-support');
    assert.equal(health.ready, true);
    assert.equal(JSON.stringify(health).includes(secret), false);
    const params = { From: '+14165550123', CallSid: 'CA_test' };
    const post = signature => fetch(origin + '/incoming', {method:'POST', headers:{'content-type':'application/x-www-form-urlencoded', ...(signature ? {'x-twilio-signature':signature} : {})}, body:new URLSearchParams(params)});
    assert.equal((await post()).status, 403);
    assert.equal((await post('invalid')).status, 403);
    const signature = twilio.getExpectedTwilioSignature(secret, origin + '/incoming', params);
    const response = await post(signature);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /<Stream url="wss:\/\/voice.example.test\/media">/);
    assert.equal((await fetch(origin + '/other')).status, 404);
  } finally {
    child.kill();
    if (child.exitCode === null) await once(child, 'exit');
  }
});
