import http from 'http';

// Test create-question on port 9006
const req = http.get('http://localhost:9006/create-question', res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    // find error info
    const patterns = [
      /"message":"[^"]{1,400}"/g,
      /ModuleBuildError.{0,300}/g,
      /SyntaxError.{0,200}/g,
      /Error:.{0,200}/g,
    ];
    for (const p of patterns) {
      const m = d.match(p);
      if (m) { console.log(m[0]); break; }
    }
    if (res.statusCode === 200) console.log('OK! Page loads fine.');
    else console.log('Body:', d.slice(0,200));
  });
});
req.setTimeout(25000, () => { console.log('Timeout'); req.destroy(); });
req.on('error', e => console.log('Error:', e.message));
