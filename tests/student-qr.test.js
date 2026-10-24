import test from 'node:test';
import assert from 'node:assert/strict';
import { drawStudentQr, shareableStudentLink, studentQrMatrix } from '../client/student-qr.js';

const link='https://class.example/?class=ABC123';

test('student QR accepts only a public HTTPS classroom link without credentials',()=>{
  assert.equal(shareableStudentLink(link),link);
  for(const unsafe of [
    'http://127.0.0.1:3000/?class=ABC123',
    'http://class.example/?class=ABC123',
    'https://class.example/',
    'https://class.example/?class=bad',
    'https://127.0.0.1/?class=ABC123',
    'https://192.168.0.2/?class=ABC123',
    'https://localhost./?class=ABC123',
    'https://[fd00::1]/?class=ABC123',
    'https://169.254.1.2/?class=ABC123',
    'https://class.example/?class=ABC123&teacher=secret',
    'https://teacher:secret@class.example/?class=ABC123',
    'https://class.example/?class=ABC123#teacher=secret',
  ])assert.throws(()=>shareableStudentLink(unsafe),/외부 접속 주소/);
});

test('student QR renders a complete scannable matrix with a white quiet zone',()=>{
  const qr=studentQrMatrix(link),count=qr.getModuleCount();
  assert.ok(count>=21&&count<=177);
  const fills=[];
  const canvas={getContext:()=>({set fillStyle(value){this.color=value;},fillRect(x,y,w,h){fills.push({color:this.color,x,y,w,h});}})};
  drawStudentQr(canvas,link);
  assert.equal(canvas.width,canvas.height);
  assert.equal(fills[0].color,'#fff');
  assert.equal(fills[0].w,canvas.width);
  const cell=canvas.width/(count+8);
  const dark=fills.slice(1);
  assert.ok(dark.length>count*count/4);
  assert.ok(dark.every(pixel=>pixel.color==='#111'&&pixel.x>=4*cell&&pixel.y>=4*cell&&pixel.x<canvas.width-4*cell&&pixel.y<canvas.height-4*cell));
  assert.equal(dark.length,Array.from({length:count},(_,row)=>Array.from({length:count},(_,col)=>qr.isDark(row,col)).filter(Boolean).length).reduce((a,b)=>a+b,0));
});
