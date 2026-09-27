import {chromium} from 'playwright';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync} from 'node:fs';
const out='validation/helper-badges';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',headless:true});const page=await browser.newPage({viewport:{width:1600,height:1000}});const errors=[];page.on('pageerror',e=>errors.push(String(e)));
try{
 await page.goto('http://127.0.0.1:5173/');await page.waitForSelector('.hero');
 const badges=await page.evaluate(async()=>{
  const a=(await import(document.querySelector('script[src*="/src/main.ts"]').src)).app;
  const T=await import('/node_modules/three/build/three.module.js');const {species}=await import('/src/data/content.ts');
  document.querySelector('#vignette').style.display='none';a.preview=undefined;a.ui.innerHTML='';a.hud.innerHTML='';a.soundControls.style.display='none';
  const scene=new T.Scene();scene.background=new T.Color('#eee9dd');scene.add(new T.HemisphereLight(0xffffff,0x777777,2.5));const light=new T.DirectionalLight(0xffffff,2.5);light.position.set(-3,6,8);scene.add(light);
  const camera=new T.OrthographicCamera(-6.4,6.4,4,-4,.1,100);camera.position.set(0,3.3,15);camera.lookAt(0,3.3,0);
  const result=[];
  for(let i=0;i<species.length;i++){const m=a.view.lib.create(species[i].id,true);m.root.position.set(((i%3)-1)*3.6,i<3?3.6:0,0);scene.add(m.root);const badge=m.root.getObjectByName('community-badge');result.push({species:species[i].id,position:badge.position.toArray()});}
  a.view.render=()=>a.view.renderer.render(scene,camera);return result;
 });
 await page.waitForTimeout(100);await page.screenshot({path:`${out}/six-species.png`});
 assert.ok(badges.every(b=>b.position[0]>.4&&b.position[1]>.1));assert.deepEqual(errors,[]);writeFileSync(`${out}/chrome.json`,JSON.stringify({badges,errors,completed:true},null,2));console.log('六種協力者徽章側上方定位與畫面渲染通過');
}finally{await browser.close();}
