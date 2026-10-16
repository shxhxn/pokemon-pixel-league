async(page)=>{
  await page.route('**/qa-environment.html',r=>r.fulfill({contentType:'text/html',body:'<html><body style="margin:0;background:#15192d;color:#e9dff1;font:14px monospace;padding:20px"><main style="display:grid;grid-template-columns:1fr 1fr;gap:20px"></main></body></html>'}));
  await page.goto('http://127.0.0.1:5173/qa-environment.html');
  await page.setViewportSize({width:1440,height:1100});
  const result=await page.evaluate(async()=>{
    const {loadEnvironmentAssets}=await import('/src/game/environmentAssets.ts');
    const {MoonlitLandscape}=await import('/src/game/landscape.ts');
    const {DISTRICTS}=await import('/src/game/environmentPlan.ts');
    const assets=await loadEnvironmentAssets(),scene=new MoonlitLandscape(assets,8);
    const c=document.createElement('canvas');c.width=960;c.height=432;const ctx=c.getContext('2d',{willReadFrequently:true});
    const hash=()=>{const p=ctx.getImageData(0,0,960,432).data;let h=2166136261;for(let i=0;i<p.length;i+=4)h=Math.imul(h^p[i]^p[i+1]^p[i+2],16777619);return h>>>0;};
    scene.draw(ctx,960,432,0,4000,true);const initial=hash();
    const measurements=[];
    for(let i=0;i<60;i++){
      const scroll=i*19000,start=performance.now();scene.draw(ctx,960,432,scroll,4000,true);measurements.push(performance.now()-start);
      if(scene.stats.cacheSize>28)throw Error('Unbounded scenery cache');
      const rgba=ctx.getImageData(0,0,960,432).data;for(let p=3;p<rgba.length;p+=4)if(rgba[p]!==255)throw Error('Empty background pixel');
    }
    scene.draw(ctx,960,432,0,4000,true);if(hash()!==initial)throw Error('Scenery changed after returning to origin');
    const cached=[];for(let i=0;i<90;i++){const start=performance.now();scene.draw(ctx,960,432,i,4000+i*16,true);cached.push(performance.now()-start);}
    for(let i=0;i<6;i++){
      const section=document.createElement('section');section.textContent=DISTRICTS[i];
      const art=document.createElement('canvas');art.width=960;art.height=432;art.style.cssText='width:100%;display:block;margin-top:10px;image-rendering:pixelated';
      // Place each composition near the centre of the corresponding town district.
      const scroll=i*1152/.4;scene.draw(art.getContext('2d'),960,432,scroll,4000,true);section.append(art);document.querySelector('main').append(section);
    }
    const p95=list=>list.sort((a,b)=>a-b)[Math.floor(list.length*.95)];
    return {maxDistancePixels:59*19000,revisitMatches:true,cache:scene.stats.cacheSize,tilesBuilt:scene.stats.tilesBuilt,cachedDrawP95Ms:p95(cached),newTileDrawP95Ms:p95(measurements)};
  });
  await page.screenshot({path:'artifacts/moonlit-districts.png',fullPage:true});
  return result;
}
