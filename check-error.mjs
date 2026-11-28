import http from 'http';

const req = http.get('http://localhost:9005/create-question', res => {
  let d = '';
  res.on('data', c => d += c);
  res.on('end', () => {
    console.log('Status:', res.statusCode);
    // Extract error info from Next.js error response
    const msgMatch = d.match(/"message":"([^"]+)"/);
    const stackMatch = d.match(/"stack":"([^"]{0,500})"/);
    const errMatch = d.match(/Error: ([^\n<]{1,200})/);
    if (msgMatch) console.log('Message:', msgMatch[1]);
    if (stackMatch) console.log('Stack:', stackMatch[1]);
    if (errMatch) console.log('Error:', errMatch[1]);
    // Show raw excerpt
    const bodyIdx = d.indexOf('"err":{');
    if (bodyIdx >= 0) console.log('err block:', d.slice(bodyIdx, bodyIdx + 500));
    else console.log('Body (first 600):', d.slice(0, 600));
  });
});
req.on('error', e => console.log('Request error:', e.message));
