const http=require('http'),fs=require('fs'),path=require('path'),{chromium}=require('playwright');
const root=__dirname;
const srv=http.createServer((q,r)=>{const p=path.join(root,decodeURIComponent(q.url.split('?')[0]));fs.readFile(p,(e,d)=>{if(e){r.writeHead(404);r.end();return;}r.writeHead(200,{'Content-Type':p.endsWith('.js')?'text/javascript':p.endsWith('.json')?'application/json':'text/html'});r.end(d);});});
srv.listen(0,async()=>{
  const br=await chromium.launch({args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
  const pg=await br.newPage({viewport:{width:1080,height:1920}});
  await pg.goto(`http://localhost:${srv.address().port}/index.html`); await pg.waitForFunction('window.__ready===true',null,{timeout:120000});
  const d=await pg.evaluate(()=>{ const c=renderFrameCanvas(19.3); return c; });
  fs.writeFileSync(path.join(root,'capa.jpg'),Buffer.from(d.split(',')[1],'base64')); await br.close(); srv.close();
});
