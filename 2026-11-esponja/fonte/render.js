const http=require('http'),fs=require('fs'),path=require('path'),{chromium}=require('playwright'),{spawn}=require('child_process');
const root=__dirname; const mode=process.argv[2]||'test';
const types={'.js':'text/javascript','.html':'text/html','.json':'application/json','.woff2':'font/woff2'};
const srv=http.createServer((q,r)=>{const p=path.join(root,decodeURIComponent(q.url.split('?')[0]));fs.readFile(p,(e,d)=>{if(e){r.writeHead(404);r.end();return;}r.writeHead(200,{'Content-Type':types[path.extname(p)]||'application/octet-stream'});r.end(d);});});
srv.listen(0,async()=>{
  const port=srv.address().port;
  const br=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});
  const pg=await br.newPage({viewport:{width:1080,height:1920}});
  pg.on('console',m=>{ if(m.type()==='error'||m.type()==='warning') console.log('PAGE',m.type(),m.text().slice(0,300)); });
  pg.on('pageerror',e=>console.log('PAGEERR',e.message));
  await pg.goto(`http://localhost:${port}/index.html`);
  await pg.waitForFunction('window.__ready===true',null,{timeout:120000});
  fs.writeFileSync(path.join(root,'cues.json'),JSON.stringify(await pg.evaluate('getCues()'),null,1));
  if(mode==='test'){
    const times=process.argv.slice(3).map(Number); fs.mkdirSync(path.join(root,process.env.TD||'test'),{recursive:true});
    for(const t of times){ const t0=Date.now(); const d=await pg.evaluate(`renderFrame(${t},0.85)`); fs.writeFileSync(path.join(root,process.env.TD||'test',`f_${t.toFixed(2)}.jpg`),Buffer.from(d.split(',')[1],'base64')); console.log('frame',t,Date.now()-t0,'ms'); }
  } else {
    const fps=30; const total=JSON.parse(fs.readFileSync(path.join(root,'timeline.json'))).total; const N=Math.ceil(total*fps);
    const a=+(process.argv[3]||0), b=Math.min(N,+(process.argv[4]||N)); const outf=process.argv[5]||path.join(root,'video.mp4');
    const ff=spawn('ffmpeg',['-y','-f','image2pipe','-framerate',String(fps),'-c:v','mjpeg','-i','-','-c:v','libx264','-preset','medium','-crf','18','-pix_fmt','yuv420p',outf],{stdio:['pipe','ignore','inherit']});
    const t0=Date.now();
    for(let i=a;i<b;i++){ const d=await pg.evaluate(`renderFrame(${(i+0.5)/fps},0.93)`); const buf=Buffer.from(d.split(',')[1],'base64'); if(!ff.stdin.write(buf)) await new Promise(r=>ff.stdin.once('drain',r)); if(i%60===0) console.log('frame',i,'/',b,((Date.now()-t0)/1000).toFixed(0)+'s'); }
    ff.stdin.end(); await new Promise(r=>ff.on('close',r));
  }
  await br.close(); srv.close();
});
