async (page) => {
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/qa-action.html',r=>r.fulfill({contentType:'text/html',body:'<html><body style="margin:0;background:#14182b"><div id="game"></div></body></html>'}));
  await page.goto('http://127.0.0.1:5173/qa-action.html');
  await page.evaluate(async()=>{
    const source=await(await fetch('/src/game/LeagueScene.ts')).text(), url=source.match(/from "([^"]*phaser[^"]*)"/)[1];
    const {default:Phaser}=await import(url),{LeagueScene}=await import('/src/game/LeagueScene.ts');
    window.s=new LeagueScene({pokemon:25,worldVersion:5,seed:8,maxDuration:600,practice:true,onFinish:r=>window.result=r,onHud:h=>window.hud=h,onReady:()=>window.ready=true,onError:e=>window.assetError=e});
    window.game=new Phaser.Game({type:Phaser.AUTO,parent:'game',width:960,height:432,pixelArt:true,physics:{default:'arcade',arcade:{gravity:{x:0,y:1000}}},scene:[window.s],audio:{noAudio:true}});
    window.spawn=(kind,x=400,y=319)=>{const e=s.enemies.create(x,y,'enemy');e.setData({id:`0:e:test-${kind}`,kind,baseX:x,baseY:y,range:20});s.director.init(e,kind);return e;};
    window.clearEnemies=()=>{s.enemies.clear(true,true);s.director.boss=null;s.enemyBolts.clear(true,true);s.bolts.clear(true,true);};
  });
  await page.waitForFunction(()=>window.ready,{timeout:20000});
  await page.evaluate(()=>s.events.emit('start-run'));await page.waitForTimeout(2700);
  await page.keyboard.down('ArrowRight');await page.waitForTimeout(180);await page.keyboard.up('ArrowRight');
  const move=await page.evaluate(()=>s.player.x>96);
  await page.keyboard.press('Space');await page.waitForTimeout(90);
  const jump=await page.evaluate(()=>s.player.body.velocity.y<0);
  await page.keyboard.press('Space');await page.waitForTimeout(90);
  const double=await page.evaluate(()=>!s.airJump&&s.player.body.velocity.y<0);
  await page.evaluate(()=>{clearEnemies();s.player.body.reset(360,319);window.foe=spawn('geodude',405);foe.setData('ready',1e9);});
  await page.keyboard.press('x');await page.waitForTimeout(200);
  const multiHit=await page.evaluate(()=>({hp:foe.getData('hp'),active:foe.active,bolts:s.bolts.countActive(true)}));
  await page.keyboard.press('c');await page.waitForTimeout(200);
  const special=await page.evaluate(()=>({energy:s.combat.energy,dead:!foe.active,kills:s.combat.kills,dash:s.combat.dashUnlocked,events:s.combat.events.length}));
  await page.keyboard.press('Shift');await page.waitForTimeout(70);
  const dash=await page.evaluate(()=>Math.abs(s.player.body.velocity.x)>300);
  const guard=await page.evaluate(()=>{s.health=3;s.combat.dashUntil=0;s.combat.held='shield';s.combat.useItem();s.hurtUntil=0;const before=s.health;s.damage();const shield=s.health===before;s.hurtUntil=0;s.damage();const hit=s.health===before-1;s.damage();return {shield,hit,cooldown:s.health===before-1};});
  const items=await page.evaluate(()=>{s.combat.itemReady=0;s.combat.held='slow';s.combat.useItem();const slow=s.combat.slowScale===.5;s.combat.buffs.slow=s.elapsed()-1;const expired=s.combat.slowScale===1;s.combat.itemReady=0;s.combat.held='berry';s.combat.useItem();return {slow,expired,healed:s.health===3};});
  await page.evaluate(()=>{clearEnemies();s.player.body.reset(350,319);window.ghost=spawn('gastly',520,240);ghost.setData('ready',0);});
  await page.waitForTimeout(1700);
  const warning=await page.evaluate(()=>({windup:ghost.getData('windup'),shots:s.enemyBolts.countActive(true)}));
  await page.waitForTimeout(1100);
  const shots=await page.evaluate(()=>s.enemyBolts.countActive(true));
  await page.evaluate(()=>s.events.emit('toggle-pause'));const pause1=await page.evaluate(()=>({elapsed:s.elapsed(),ai:s.director.clock,x:ghost.x}));await page.waitForTimeout(220);const pause2=await page.evaluate(()=>({elapsed:s.elapsed(),ai:s.director.clock,x:ghost.x}));await page.evaluate(()=>s.events.emit('toggle-pause'));
  const bosses=await page.evaluate(()=>{const results=[];for(const kind of ['gengar','onix','electabuzz']){clearEnemies();s.player.body.reset(350,319);const e=spawn(kind,520,kind==='gengar'?230:303);s.director.update(16);const entered=!!s.director.bossHud;e.setData('hp',1);s.combat.hit(e,10,true);s.director.update(16);results.push({kind,entered,exited:!s.director.bossHud});}return results;});
  const hazard=await page.evaluate(()=>{const h=s.hazards.create(350,327,'trap-electric');h.setData({kind:'electric',baseX:350,baseY:327});s.traps.clock=1600-350*3;s.traps.update(s.hazards,0,false);const warning=!h.getData('danger')&&s.traps.warning.startsWith('!');s.traps.clock=2300-350*3;s.traps.update(s.hazards,0,false);const active=h.getData('danger');s.traps.update(s.hazards,0,true);const suspended=!h.getData('danger');h.destroy();return {warning,active,suspended};});
  const bounds=await page.evaluate(()=>{for(let i=1;i<100;i++){s.furthest=i*768;s.syncWorld();}return {chunks:s.chunks.size,enemies:s.enemies.getLength(),particles:s.particles};});
  const results={move,jump,double,multiHit,special,dash,guard,items,warning,shots,pauseStable:JSON.stringify(pause1)===JSON.stringify(pause2),bosses,hazard,bounds,errors,assetError:await page.evaluate(()=>window.assetError)};
  if(!move||!jump||!double||multiHit.hp!==4||!special.dead||!special.dash||!dash||!Object.values(guard).every(Boolean)||!Object.values(items).every(Boolean)||warning.shots||!shots||!results.pauseStable||bosses.some(b=>!b.entered||!b.exited)||!Object.values(hazard).every(Boolean)||bounds.chunks>4||errors.length||results.assetError)throw Error(JSON.stringify(results));
  return results;
}

