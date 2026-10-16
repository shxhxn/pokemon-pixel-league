async(page)=>{
  const result=await page.evaluate(async()=>{
    const {kitFor,FOES,TRAPS}=await import('/shared/action.ts');
    const {updateProjectiles}=await import('/src/game/action/projectiles.ts');
    const s=window.s;s.furthest=96;s.cameras.main.scrollX=0;s.syncWorld();clearEnemies();s.player.body.reset(350,319);s.health=3;
    const kits=[];
    for(const id of [25,158,4,7,1]){
      clearEnemies();s.player.body.reset(350,319);s.combat.kit=kitFor(id);s.combat.energy=100;s.combat.basicReady=0;s.combat.specialReady=0;s.combat.flameUntil=0;
      const e=spawn('geodude',395);e.setData('ready',1e9);
      s.combat.basic();const basic=s.bolts.countActive(true)>0||e.getData('hp')<5;
      e.setData('hitUntil',0);s.combat.energy=100;s.shieldUntil=0;s.combat.special();s.combat.update();
      const special=s.combat.energy<100&&(s.shieldUntil>s.elapsed()||s.bolts.countActive(true)>1||e.getData('hp')<4||s.combat.flameUntil>s.elapsed());
      kits.push({id,basic,special});
    }
    const grounding=[];clearEnemies();
    for(const kind of Object.keys(FOES)){
      const e=spawn(kind,500,230);s.director.update(16);
      const visual=e.getData('visual');grounding.push({kind,animated:!!visual?.anims.currentAnim,grounded:FOES[kind].fly||Math.abs(e.y+e.displayHeight/2-336)<.1});e.destroy();s.director.boss=null;
    }
    const hazards=[];
    for(const kind of TRAPS){const h=s.hazards.create(350,kind==='pendulum'?244:327,`trap-${kind}`);h.setData({kind,baseX:350,baseY:h.y});h.setDisplaySize(40,18).refreshBody();s.traps.update(s.hazards,16,false);hazards.push({kind,configured:typeof h.getData('danger')==='boolean'});h.destroy();}
    clearEnemies();s.player.body.reset(300,319);const g=spawn('gengar',520,230);s.director.update(16);g.setData({hp:10,seen:true,windup:s.director.clock+1,targetX:300,targetY:319,originX:520,originY:230,attackDamage:0});s.director.update(16);
    const summons=s.enemies.getChildren().filter(e=>e.getData('summoned')).length;
    g.disableBody(true,true);s.director.update(16);const cleanedSummons=s.enemies.getChildren().filter(e=>e.getData('summoned')).length===0;
    const future=s.bolts.create(300,250,'bolt');future.setData('expires',s.elapsed()-1);updateProjectiles([s.bolts],s.elapsed(),0,960);const cleanup=!future.active;
    const camStart=s.cameras.main.scrollX;s.player.body.reset(2000,280);s.update(100000,16);const camera=s.cameras.main.scrollX>camStart;
    const bounded={enemies:s.enemies.getLength(),projectiles:s.enemyBolts.countActive(true),particles:s.particles,chunks:s.chunks.size};
    return {kits,grounding,hazards,summons,cleanedSummons,cleanup,camera,bounded};
  });
  if(result.kits.some(k=>!k.basic||!k.special)||result.grounding.some(e=>!e.animated||!e.grounded)||result.hazards.some(h=>!h.configured)||result.summons!==1||!result.cleanedSummons||!result.cleanup||!result.camera||result.bounded.chunks>4)throw Error(JSON.stringify(result));
  return result;
}

