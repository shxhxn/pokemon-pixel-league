async (page) => {
  await page.route('**/qa-adventure.html',r=>r.fulfill({contentType:'text/html',body:'<html><body style="margin:0;background:#111628"><div id="test-game"></div></body></html>'}));
  await page.goto('http://127.0.0.1:5173/qa-adventure.html');
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.evaluate(async()=>{
    const source=await(await fetch('/src/game/LeagueScene.ts')).text();
    const {default:Phaser}=await import(source.match(/from "([^"]*phaser[^"]*)"/)[1]);
    const {LeagueScene}=await import('/src/game/LeagueScene.ts');
    window.s=new LeagueScene({pokemon:25,seed:8,maxDuration:600,practice:true,onFinish:r=>window.result=r,onHud:h=>window.hud=h,onReady:()=>window.ready=true,onError:e=>window.error=e});
    window.game=new Phaser.Game({type:Phaser.AUTO,parent:'test-game',width:960,height:432,pixelArt:true,physics:{default:'arcade',arcade:{gravity:{x:0,y:1000}}},scene:[window.s],audio:{noAudio:true}});
    window.place=(index,x=450)=>{const s=window.s;s.furthest=index*768+x;s.syncWorld();s.player.body.reset(s.furthest,320);s.health=3;s.hurtUntil=0;};
  });
  await page.waitForFunction(()=>window.ready);
  await page.evaluate(()=>window.s.events.emit('start-run'));await page.waitForTimeout(2600);
  await page.evaluate(()=>window.place(3));await page.waitForTimeout(750);
  const warningAndShot=await page.evaluate(()=>({turret:window.s.enemies.getChildren().filter(e=>e.active&&e.getData('kind')==='turret').map(e=>({windup:e.getData('windup'),ready:e.getData('readyAt')})),shots:window.s.enemyBolts.countActive()}));
  await page.waitForTimeout(1400);
  const enemyDamage=await page.evaluate(()=>window.s.health);
  await page.keyboard.press('x');await page.waitForTimeout(500);
  const defeated=await page.evaluate(()=>Array.from(window.s.defeated));
  const shield=await page.evaluate(()=>{
    window.place(2,650);const s=window.s;s.enemies.getChildren().forEach(e=>e.disableBody(true,true));
    const item=s.pickups.getChildren().find(p=>p.active&&p.getData('kind')==='shield');
    s.collectPower(item);s.damage();return {health:s.health,remaining:s.shieldUntil-s.elapsed()};
  });
  const rapid=await page.evaluate(()=>{
    const s=window.s;s.rapidUntil=s.elapsed()+8000;s.attackAt=-1000;s.attack();s.attack();return s.bolts.countActive();
  });
  await page.waitForTimeout(210);
  const rapidSecond=await page.evaluate(()=>{const s=window.s;s.attack();return s.bolts.countActive();});
  const magnet=await page.evaluate(()=>{
    const s=window.s;s.magnetUntil=s.elapsed()+8000;const c=s.coins.getChildren().find(c=>c.active);c.setPosition(s.player.x+60,s.player.y).refreshBody();return {id:c.getData('id'),before:s.collected.has(c.getData('id'))};
  });
  await page.waitForTimeout(60);
  magnet.after=await page.evaluate(id=>window.s.collected.has(id),magnet.id);
  const heart=await page.evaluate(()=>{
    const s=window.s;s.health=2;const p=s.pickups.create(s.player.x,s.player.y,'heart').setData({id:'qa:heart',kind:'heart'});s.collectPower(p);s.collectPower(p);return s.health;
  });
  const phases=[];
  for(const ms of [0,30000,60000,90000]){
    await page.evaluate(ms=>{window.s.started=performance.now()-ms;window.s.pausedTotal=0;},ms);await page.waitForTimeout(100);
    phases.push(await page.evaluate(()=>({time:window.hud.timeOfDay,level:window.hud.difficulty,speed:window.s.player.body.maxVelocity.x})));
  }
  await page.screenshot({path:'artifacts/adventure-night.png'});
  const results={warningAndShot,enemyDamage,defeated,shield,rapid,rapidSecond,magnet,heart,phases,errors};
  if(!warningAndShot.shots||enemyDamage!==2||!defeated.length||shield.health!==3||shield.remaining<7900||rapidSecond<=rapid||!magnet.after||heart!==3||phases[3].level!==5||errors.length)throw Error(JSON.stringify(results));
  return results;
}
