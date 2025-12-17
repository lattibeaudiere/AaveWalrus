const express = require('express');
const bodyParser = require('body-parser');
const app = express();
app.use(bodyParser.json({ limit: '5mb' }));

const USE_MOCK = process.env.SEAL_WRAPPER_USE_MOCK !== 'false';

function mockEncrypt(plaintext_b64, policy) {
  // Return JSON envelope similar to Python mock
  return {
    seal: true,
    policy: policy || {},
    ciphertext: plaintext_b64,
    meta: { method: 'mock' }
  };
}

function mockDecrypt(obj, user_id, user_role) {
  const policy = obj.policy || {};
  const ptype = policy.type;
  const pname = policy.name;
  let allowed = false;
  let reason = 'unknown_policy';
  if (ptype === 'public') {
    allowed = true;
    reason = 'public_policy';
  } else if (pname && user_role && pname === user_role) {
    allowed = true;
    reason = 'role_match';
  }
  if (!allowed) {
    return { allowed: false, reason };
  }
  return { allowed: true, reason, plaintext: obj.ciphertext };
}

app.post('/encrypt', async (req, res) => {
  try {
    const { policy, plaintext } = req.body;
    if (!plaintext) return res.status(400).json({ error: 'missing plaintext' });

    // If we had a real SDK, we'd call it here. For now use mock.
    const plaintext_b64 = Buffer.from(plaintext, 'utf-8').toString('base64');
    const envelope = mockEncrypt(plaintext_b64, policy);
    return res.json({ ciphertext: envelope.ciphertext, meta: envelope.meta });
  } catch (e) {
    return res.status(500).json({ error: e.toString() });
  }
});

app.post('/decrypt', async (req, res) => {
  try {
    const { ciphertext, user_id, user_role } = req.body;
    if (!ciphertext) return res.status(400).json({ error: 'missing ciphertext' });

    // If ciphertext is an object envelope, accept that too
    let obj = null;
    if (typeof ciphertext === 'string') {
      try { obj = JSON.parse(Buffer.from(ciphertext, 'base64').toString('utf-8')); } catch (e) { obj = { ciphertext }; }
    } else if (typeof ciphertext === 'object') {
      obj = ciphertext;
    }

    const result = mockDecrypt(obj, user_id, user_role);
    if (!result.allowed) return res.json({ allowed: false, reason: result.reason });

    return res.json({ allowed: true, reason: result.reason, plaintext: result.plaintext });
  } catch (e) {
    return res.status(500).json({ error: e.toString() });
  }
});

const port = process.env.SEAL_WRAPPER_PORT || 3001;
app.listen(port, () => console.log(`Seal wrapper listening on ${port} (USE_MOCK=${USE_MOCK})`));
