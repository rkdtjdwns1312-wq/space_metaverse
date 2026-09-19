import assert from 'node:assert/strict';
// 개별 조작 영역을 비교합니다. 부모 컨테이너는 화면 전체에 걸칠 수 있습니다.
export async function verifyControlsLayout(page,width){
 await page.setViewportSize({width,height:844});await page.waitForTimeout(120);
 assert.equal(await page.locator('#touch-controls').count(),0);
 const ids=['.combat-buttons','#touch-interact','#joystick','.bottom-dock','#vitals-hud'];
 const boxes=[];
 for(const id of ids){if(await page.locator(id).isVisible())boxes.push([id,await page.locator(id).boundingBox()]);}
 const overlap=(a,b)=>a.x<b.x+b.width-1&&b.x<a.x+a.width-1&&a.y<b.y+b.height-1&&b.y<a.y+a.height-1;
 for(const [id,b] of boxes)assert.ok(b.x>=0&&b.y>=0&&b.x+b.width<=width+1&&b.y+b.height<=845,id+' outside '+width);
 for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++)assert.ok(!overlap(boxes[i][1],boxes[j][1]),`${width}: ${boxes[i][0]} overlaps ${boxes[j][0]}`);
 const attack=await page.locator('#touch-attack').boundingBox(),skill=await page.locator('#touch-skill').boundingBox(),investigate=await page.locator('#touch-interact').boundingBox(),stick=await page.locator('#joystick').boundingBox(),dock=await page.locator('.bottom-dock').boundingBox();
 assert.equal(attack.width,84);assert.equal(skill.width,84);assert.equal(investigate.width,126);assert.equal(investigate.height,63);assert.equal(stick.width,114);
 assert.ok(Math.abs(investigate.x+investigate.width/2-((attack.x+attack.width/2+skill.x+skill.width/2)/2))<1,'investigate horizontal center '+width);
 assert.ok(attack.x<width/2&&skill.x<width/2);assert.ok(investigate.y>=attack.y+attack.height);
 assert.ok(Math.abs(attack.y+attack.height/2-(stick.y+stick.height/2))<1,'attack/joystick centerY '+width);
 if(width>=768)assert.ok(Math.abs(stick.x+stick.width/2-(dock.x+dock.width+width)/2)<3,'joystick midpoint '+width);
 assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
}
