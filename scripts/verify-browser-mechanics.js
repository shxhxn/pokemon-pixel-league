async (page) => {
  await page.route('**/qa-mechanics.html',r=>r.fulfill({contentType:'text/html',body:'<html><body><div id="test-game"></div></body></html>'}));
  await page.goto('http://127.0.0.1:5173/qa-mechanics.html');
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.evaluate(async()=>{
    const source=await(await fetch('/src/game/LeagueScene.ts')).text();
    const url=source.match(/from "([^"]*phaser[^"]*)"/)[1];
    const {default:Phaser}=await import(url);
    const {LeagueScene}=await import('/src/game/LeagueScene.ts');
    const {generateChunk}=await import('/shared/world.ts');
    window.__qaChunks=Array.from({length:30},(_,i)=>generateChunk(8,i,4));
    window.__qaScene=new LeagueScene({pokemon:25,worldVersion:4,seed:8,maxDuration:600,practice:true,onFinish:r=>window.__qaResult=r,onHud:h=>window.__qaHud=h,onReady:()=>window.__qaReady=true,onError:e=>window.__qaError=e});
    window.__qaGame=new Phaser.Game({type:Phaser.AUTO,parent:'test-game',width:768,height:432,pixelArt:true,physics:{default:'arcade',arcade:{gravity:{x:0,y:1000}}},scene:[window.__qaScene],audio:{noAudio:true}});
    window.__place=(route,kind)=>{
      const s=window.__qaScene,c=window.__qaChunks.find(c=>c.route===route);
      s.furthest=c.start+100;s.syncWorld();s.player.body.reset(c.start+100,300);s.hurtUntil=0;s.health=3;
      return c;
    };
  });
  await page.waitForFunction(()=>window.__qaReady);
  await page.evaluate(()=>window.__qaScene.events.emit('start-run'));
  await page.waitForTimeout(2700);await page.waitForFunction(()=>window.__qaScene.player.body.blocked.down||window.__qaScene.player.body.touching.down);await page.waitForTimeout(200);
  await page.keyboard.down('ArrowRight');await page.waitForTimeout(250);
  const run=await page.evaluate(()=>({animation:window.__qaScene.animation,x:window.__qaScene.player.x}));
  await page.keyboard.press('Space');await page.waitForTimeout(120);
  const jump=await page.evaluate(()=>({animation:window.__qaScene.animation,vy:window.__qaScene.player.body.velocity.y}));
  await page.keyboard.press('Space');await page.waitForTimeout(100);
  const double=await page.evaluate(()=>({airJump:window.__qaScene.airJump,vy:window.__qaScene.player.body.velocity.y}));
  await page.keyboard.up('ArrowRight');await page.waitForTimeout(1100);
  await page.evaluate(()=>window.__qaScene.events.emit('toggle-pause'));
  const t1=await page.evaluate(()=>window.__qaScene.elapsed());await page.waitForTimeout(200);
  const t2=await page.evaluate(()=>window.__qaScene.elapsed());
  await page.evaluate(()=>window.__qaScene.events.emit('toggle-pause'));
  await page.evaluate(()=>{const c=window.__place(1),s=window.__qaScene;s.player.body.reset(c.hazards[0].x,300);s.player.setVelocityY(100);});
  await page.waitForTimeout(300);
  const spikes=await page.evaluate(()=>window.__qaScene.health);
  await page.evaluate(()=>{const c=window.__place(2),s=window.__qaScene,p=c.platforms.find(p=>p.solid);s.player.body.reset(p.x-40,320);});
  await page.keyboard.down('ArrowRight');await page.waitForTimeout(450);await page.keyboard.up('ArrowRight');
  const crate=await page.evaluate(()=>{const c=window.__qaChunks.find(c=>c.route===2);return window.__qaScene.player.x<=c.platforms.find(p=>p.solid).x-11;});
  await page.evaluate(()=>{const c=window.__place(3),s=window.__qaScene;s.player.body.reset(c.springs[0].x,300);s.player.setVelocityY(100);});
  await page.waitForTimeout(220);
  const spring=await page.evaluate(()=>window.__qaScene.player.body.velocity.y);
  await page.evaluate(()=>{const c=window.__place(6),s=window.__qaScene,p=c.platforms.find(p=>p.crumble);s.player.body.reset(p.x+p.width/2,p.y-30);s.player.setVelocityY(100);});
  await page.waitForTimeout(1100);
  const crumble=await page.evaluate(()=>window.__qaScene.platforms.getChildren().filter(p=>p.getData('crumble')).map(p=>({active:p.active,triggered:p.getData('triggered')})));
  await page.evaluate(()=>window.__place(7));
  const m1=await page.evaluate(()=>window.__qaScene.platforms.getChildren().find(p=>p.getData('motion')).y);
  await page.waitForTimeout(200);
  const m2=await page.evaluate(()=>window.__qaScene.platforms.getChildren().find(p=>p.getData('motion')).y);
  await page.evaluate(()=>{window.__qaScene.furthest=20*768;window.__qaScene.syncWorld();});
  const chunks=await page.evaluate(()=>window.__qaScene.chunks.size);
  const results={run,jump,double,pauseClockStable:t1===t2,spikesHealth:spikes,crateBlocks:crate,springVelocity:spring,crumble,movingPlatformMoves:m1!==m2,chunks,errors};
  if(run.animation!=='run'||jump.vy>=0||double.airJump||spikes!==2||!crate||spring>=0||!crumble.some(p=>!p.active)||m1===m2||chunks>4||errors.length)throw Error(JSON.stringify(results));
  return results;
}


