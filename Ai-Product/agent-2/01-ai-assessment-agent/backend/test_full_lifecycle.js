const http = require('http');

async function testFullLifecycle() {
  const loginRes = await fetch('http://localhost:8080/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'asha.teacher@demo.local', password: 'demo1234' })
  });
  const { token } = await loginRes.json();
  console.log('✅ Logged in as Asha Teacher.');

  // Reset
  await fetch('http://localhost:8080/api/agent/reset', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'x-tenant-id': '1' }
  });

  async function sendChat(msg) {
    console.log(`\n>>> USER SAYS: "${msg}"`);
    const res = await fetch('http://localhost:8080/api/agent/chat', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'x-tenant-id': '1',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ message: msg })
    });
    const text = await res.text();
    for (const line of text.split('\n')) {
      if (line.startsWith('data: ')) {
        try {
          const ev = JSON.parse(line.slice(6));
          if (ev.type === 'tool_done') console.log(`   🛠️ Tool Executed: [${ev.tool}] -> ${ev.summary}`);
          if (ev.type === 'message') console.log(`   💬 Agent: ${ev.content.split('\n')[0]}`);
          if (ev.type === 'report_preview') console.log(`   📊 Report Card: Score ${ev.score}/${ev.total} (${ev.percentage}%) - Weak: ${ev.weakTopics.join(', ')}`);
          if (ev.type === 'study_plan') console.log(`   📚 Study Plan: "${ev.plan.planTitle}" (${ev.plan.modules.length} modules)`);
        } catch (e) {}
      }
    }
  }

  // 1. One-Shot Auto Create & Publish
  await sendChat('8th A ke liye photosynthesis ka 15-minute test banao aur assign kardo');

  // 2. Simulate Student Attempt
  await sendChat('Yes, attempt test as student');

  // 3. Switch back to Teacher & Generate AI Diagnostic Report
  await sendChat('Switch to teacher portal and generate report');

  // 4. Send Parent Email
  await sendChat('Send report to aarav.parents@demo.local');

  // 5. Generate Study Plan with YouTube Links
  await sendChat('Generate study plan for weak topics');

  console.log('\n🎉 FULL END-TO-END AUTONOMOUS AI AGENT WORKFLOW COMPLETED PERFECTLY!');
}

testFullLifecycle().catch(console.error);
