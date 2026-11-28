import http from 'http';

// Force compile /create-question by requesting it and capturing full error
const req = http.get('http://localhost:9005/create-question', {
  headers: { 'Accept': 'text/html,application/json' }
}, res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    console.log('HTTP Status:', res.statusCode);
    // Try to find module error
    const patterns = [
      /ModuleBuildError[^<"]{0,500}/,
      /SyntaxError[^<"]{0,300}/,
      /Cannot find module[^<"]{0,200}/,
      /is not defined[^<"]{0,200}/,
      /"message":"([^"]{1,300})"/,
      /"stack":"([^"]{0,500})"/,
    ];
    let found = false;
    for (const p of patterns) {
      const m = d.match(p);
      if (m) { console.log(m[0]); found = true; }
    }
    if (!found) console.log('Raw:', d.slice(0, 200));
  });
});
req.setTimeout(25000);
req.on('error', e => console.log('Error:', e.message));
