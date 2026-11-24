async function testNewFeatures() {
  const loginRes = await fetch('http://localhost:8080/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'asha.teacher@demo.local', password: 'demo1234' })
  });
  const { token } = await loginRes.json();
  console.log('✅ Logged in as Asha Teacher.');

  // Test 1: Incomplete prompt -> Clarification
  console.log('\n--- TEST 1: INCOMPLETE PROMPT (NO CLASS GIVEN) ---');
  await fetch('http://localhost:8080/api/agent/reset', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'x-tenant-id': '1' }
  });

  async function chat(msg) {
    console.log(`\nTeacher: "${msg}"`);
    const res = await fetch('http://localhost:8080/api/agent/chat', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'x-tenant-id': '1', 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg })
    });
    const text = await res.text();
    for (const line of text.split('\n')) {
      if (line.startsWith('data: ')) {
        try {
          const ev = JSON.parse(line.slice(6));
          if (ev.type === 'message') console.log(`Agent: ${ev.content.split('\n')[0]}`);
          if (ev.type === 'options_prompt') console.log('Options presented:', ev.options?.map(o => o.label));
          if (ev.type === 'tool_done') console.log(`Tool done: [${ev.tool}] -> ${ev.summary}`);
        } catch(e) {}
      }
    }
  }

  // Teacher asks without class
  await chat('Photosynthesis par 14 questions ka test banao');

  // Teacher selects class
  await chat('Grade 8 - A');

  // Test 2: Scheduled publishing
  console.log('\n--- TEST 2: SCHEDULED PUBLISHING TOMORROW AT 8:40 ---');
  await fetch('http://localhost:8080/api/agent/reset', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'x-tenant-id': '1' }
  });
  await chat('8.40 pr kal publish kar dena assessment 14 questions ka photosynthesis par 8th A ke liye');
}

testNewFeatures().catch(console.error);
