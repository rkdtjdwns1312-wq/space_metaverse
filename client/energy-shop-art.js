// 별 상점과 구분되는 파스텔 유리·금속 외관. 매 프레임 외부 객체를 만들지 않습니다.
export function drawEnergyShop(ctx, object) {
  const { x, y } = object;
  const left = x - 106;
  const top = y - 110;

  ctx.save();

  // 바닥 그림자
  ctx.fillStyle = '#183a5360';
  ctx.beginPath();
  ctx.ellipse(x, y + 61, 106, 12, 0, 0, Math.PI * 2);
  ctx.fill();

  // 은색 테두리의 타원형 돔 지붕
  const metal = ctx.createLinearGradient(left, top + 27, left + 212, top + 79);
  metal.addColorStop(0, '#a9c6d4');
  metal.addColorStop(0.3, '#f5fdff');
  metal.addColorStop(0.68, '#c1dce5');
  metal.addColorStop(1, '#829fac');
  ctx.fillStyle = metal;
  ctx.strokeStyle = '#7899a8';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(left - 4, top + 61);
  ctx.quadraticCurveTo(x, top - 8, left + 216, top + 61);
  ctx.quadraticCurveTo(x, top + 77, left - 4, top + 61);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // 지붕 유리 패널과 금속 처마
  ctx.strokeStyle = '#ffffffb8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, top + 5);
  ctx.quadraticCurveTo(x - 22, top + 31, x - 34, top + 61);
  ctx.moveTo(x, top + 5);
  ctx.quadraticCurveTo(x + 22, top + 31, x + 34, top + 61);
  ctx.stroke();
  ctx.fillStyle = '#d8edf2';
  ctx.strokeStyle = '#7899a8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.ellipse(x, top + 60, 108, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // 전면 둥근 유리 벽체
  const glass = ctx.createLinearGradient(left + 12, top + 70, left + 200, y + 60);
  glass.addColorStop(0, '#e5fbff');
  glass.addColorStop(0.46, '#c9f2f4');
  glass.addColorStop(1, '#a8dfe7');
  ctx.fillStyle = glass;
  ctx.strokeStyle = '#789eaa';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.roundRect(left + 9, top + 64, 194, 112, 20);
  ctx.fill();
  ctx.stroke();

  // 유리 반사광
  ctx.strokeStyle = '#ffffffad';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(left + 25, top + 81);
  ctx.lineTo(left + 25, top + 135);
  ctx.moveTo(left + 32, top + 79);
  ctx.lineTo(left + 72, top + 79);
  ctx.stroke();

  // 양쪽 쇼윈도: 금속 프레임, 유리, 안쪽 진열 선반
  for (const windowX of [x - 73, x + 73]) {
    ctx.fillStyle = '#f2fdff';
    ctx.strokeStyle = '#829fab';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(windowX - 24, y - 18, 48, 60, 12);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#b3e8ee';
    ctx.beginPath();
    ctx.roundRect(windowX - 18, y - 12, 36, 48, 8);
    ctx.fill();
    ctx.strokeStyle = '#ffffffc9';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(windowX - 13, y - 7);
    ctx.lineTo(windowX - 13, y + 18);
    ctx.moveTo(windowX - 15, y + 15);
    ctx.lineTo(windowX + 15, y + 15);
    ctx.stroke();
    ctx.fillStyle = '#86bdc9';
    ctx.beginPath();
    ctx.arc(windowX + 5, y + 3, 5, 0, Math.PI * 2);
    ctx.fill();
  }

  // 중앙 자동문과 열린 듯한 밝은 문 안쪽
  ctx.fillStyle = '#668c9a';
  ctx.strokeStyle = '#587b89';
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(x - 28, y - 31, 56, 92, 25, 25, 3, 3);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#d9f9fb';
  ctx.beginPath();
  ctx.roundRect(x - 22, y - 27, 44, 84, 21, 21, 2, 2);
  ctx.fill();
  ctx.fillStyle = '#b0dbe2';
  ctx.fillRect(x - 1, y - 19, 2, 76);
  ctx.fillStyle = '#ffffffa8';
  ctx.fillRect(x - 17, y - 15, 4, 37);
  ctx.fillRect(x + 12, y - 15, 3, 31);
  ctx.fillStyle = '#eafcff';
  ctx.fillRect(x - 38, y + 58, 76, 5);

  // 지붕 꼭대기의 푸른 보석
  ctx.fillStyle = '#67c8e6';
  ctx.strokeStyle = '#3989ad';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, top - 1);
  ctx.lineTo(x + 12, top + 12);
  ctx.lineTo(x + 8, top + 29);
  ctx.lineTo(x, top + 34);
  ctx.lineTo(x - 8, top + 29);
  ctx.lineTo(x - 12, top + 12);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#d9fbff';
  ctx.beginPath();
  ctx.moveTo(x, top + 3);
  ctx.lineTo(x + 5, top + 13);
  ctx.lineTo(x, top + 25);
  ctx.lineTo(x - 4, top + 13);
  ctx.closePath();
  ctx.fill();

  // 간판은 한국어 한 줄로 또렷하게 표시
  ctx.fillStyle = '#edfaff';
  ctx.strokeStyle = '#7899a8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.roundRect(x - 78, top + 39, 156, 25, 8);
  ctx.fill();
  ctx.stroke();
  ctx.font = '700 15px "Jua", "Malgun Gothic", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#315d70';
  ctx.fillText('우주에너지 상점', x, top + 52, 150);

  ctx.restore();
}
