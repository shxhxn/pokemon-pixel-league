import test from 'node:test';
import assert from 'node:assert/strict';
import {difficultyAt,maxTravelPixels,progressiveClock} from '../shared/difficulty';
import {generateChunk,pressureHazards,validateChunk} from '../shared/world';

test('difficulty rises with elapsed time, reaches five levels, and caps safely',()=>{
  assert.deepEqual([0,20000,40000,60000,80000].map(t=>difficultyAt(t).level),[1,2,3,4,5]);
  assert.equal(difficultyAt(0).speed,210);
  assert.equal(difficultyAt(80000).speed,270);
  assert.equal(difficultyAt(3600000).speed,270);
  assert.equal(difficultyAt(0).crumbleMs,650);
  assert.equal(difficultyAt(80000).crumbleMs,350);
  for(let t=0;t<120000;t+=100){
    assert.ok(difficultyAt(t+100).speed>=difficultyAt(t).speed);
    assert.ok(difficultyAt(t+100).crumbleMs<=difficultyAt(t).crumbleMs);
    assert.ok(progressiveClock(t+100,.85)-progressiveClock(t,.85)<=185.001);
  }
});
test('server distance envelope integrates the actual speed ramp and preserves older sessions',()=>{
  assert.equal(maxTravelPixels(40000),9000);
  assert.equal(maxTravelPixels(80000),19200);
  assert.ok(Math.abs(maxTravelPixels(120000)-30000)<.00001);
  assert.equal(maxTravelPixels(120000,2),25200);
  assert.equal(difficultyAt(120000,2).speed,210);
  assert.equal(difficultyAt(120000,1).level,1);
  let travel=0;
  for(let t=0;t<120000;t+=10)travel+=difficultyAt(t+5).speed*.01;
  assert.ok(Math.abs(travel-maxTravelPixels(120000))<.01);
});
test('late-run pressure hazards retain safe geometry and do not alter scoring events',()=>{
  for(const seed of [1,8,42,20261013])for(let i=0;i<200;i++){
    const c=generateChunk(seed,i),before=JSON.stringify([c.coins,c.enemies]);
    assert.equal(pressureHazards(c,2).length,0);
    const extra=pressureHazards(c,5);
    assert.ok(validateChunk({...c,hazards:[...c.hazards,...extra]}));
    assert.equal(JSON.stringify([c.coins,c.enemies]),before);
    if(c.route===0||c.route===6)assert.equal(extra.length,0);
  }
});
