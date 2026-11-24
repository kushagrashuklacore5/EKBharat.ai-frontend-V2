const http = require('http');

async function testFlow() {
  // 1. Login
  const loginData = JSON.stringify({ email: 'asha.teacher@demo.local', password: 'demo1234' });
  const loginRes = await fetch('http://localhost:8080/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: loginData
  });
  const { token } = await loginRes.json();
  console.log('✅ Logged in as Asha Teacher. Token:', token.slice(0, 15) + '...');

  // 2. Reset session
  await fetch('http://localhost:8080/api/agent/reset', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'x-tenant-id': '1' }
  });
  console.log('✅ Session reset.');

  // 3. Send magic auto-publish command
  console.log('\n--- SENDING MAGIC INTENT: "8th A ke liye photosynthesis ka 15-minute test banao aur assign kardo" ---');
  const chatRes = await fetch('http://localhost:8080/api/agent/chat', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'x-tenant-id': '1',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ message: '8th A ke liye photosynthesis ka 15-minute test banao aur assign kardo' })
  });

  const text = await chatRes.text();
  const lines = text.split('\n');
  const events = [];
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      try {
        const ev = JSON.parse(line.slice(6));
        events.push(ev);
        console.log(`[EVENT: ${ev.type}]`, ev.tool || ev.label || (ev.content ? ev.content.slice(0, 70) : ''));
      } catch (e) {}
    }
  }

  const toolCalls = events.filter(e => e.type === 'tool_done').map(e => e.tool);
  console.log('\nTools executed:', toolCalls);

  // Check state
  const stateRes = await fetch('http://localhost:8080/api/agent/state', {
    headers: { Authorization: `Bearer ${token}`, 'x-tenant-id': '1' }
  });
  const state = await stateRes.json();
  console.log('Agent State Phase:', state.phase);
  console.log('Assessment ID created & published:', state.assessmentId);
}

testFlow().catch(console.error);
