import qrcode from './vendor/qrcode.mjs';

// Only a public student link belongs in a shared image. Local addresses and
// teacher credentials must never be turned into a distributable QR code.
export function shareableStudentLink(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error('외부 접속 주소가 열린 뒤 학생용 QR 코드를 만들 수 있어요.'); }
  const host=url.hostname.toLowerCase().replace(/\.$/,'');
  // Public student links use a DNS name. Excluding all IP literals also rules
  // out IPv6 ULA/link-local and less obvious IPv4 spellings.
  const privateHost=host==='localhost'||host.endsWith('.localhost')||
    host.endsWith('.local')||host.endsWith('.lan')||host.endsWith('.internal')||
    host.endsWith('.home.arpa')||!host.includes('.')||
    /^(?:\d{1,3}\.){3}\d{1,3}$/.test(host)||host.startsWith('[');
  if (url.protocol !== 'https:' || privateHost || url.username || url.password || url.hash ||
      url.pathname !== '/' || url.searchParams.size !== 1 ||
      !/^[A-Z0-9]{6}$/.test(url.searchParams.get('class') || '')) {
    throw new Error('외부 접속 주소가 열린 뒤 학생용 QR 코드를 만들 수 있어요.');
  }
  return url.href;
}

export function studentQrMatrix(value) {
  const qr = qrcode(0, 'M');
  qr.addData(shareableStudentLink(value));
  qr.make();
  return qr;
}

export function drawStudentQr(canvas, value) {
  const qr = studentQrMatrix(value);
  const modules = qr.getModuleCount();
  const cell = Math.max(4, Math.floor(480 / (modules + 8)));
  const size = (modules + 8) * cell;
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = '#111';
  for (let row = 0; row < modules; row++) {
    for (let col = 0; col < modules; col++) {
      if (qr.isDark(row, col)) ctx.fillRect((col + 4) * cell, (row + 4) * cell, cell, cell);
    }
  }
  return canvas;
}
