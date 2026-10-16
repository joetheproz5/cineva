// Local development uses the exact same authenticated API handlers as production.
const http=require("node:http"),fs=require("node:fs"),path=require("node:path");
const root=__dirname,types={".html":"text/html; charset=utf-8",".js":"application/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".webmanifest":"application/manifest+json",".svg":"image/svg+xml",".png":"image/png",".jpg":"image/jpeg",".jpeg":"image/jpeg",".webp":"image/webp",".ico":"image/x-icon",".json":"application/json",".apk":"application/vnd.android.package-archive",".mp4":"video/mp4",".txt":"text/plain"};
function config(name){try{return JSON.parse(fs.readFileSync(path.join(root,name),"utf8"));}catch{return {};}}
function environment(){const local=config("supabase.local.json"),tmdb=config("tmdb.local.json");return {...process.env,SUPABASE_URL:local.url||process.env.SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY:local.publishableKey||process.env.SUPABASE_PUBLISHABLE_KEY,SUPABASE_EMAIL_REDIRECT_TO:local.emailRedirectTo||process.env.SUPABASE_EMAIL_REDIRECT_TO,TMDB_BEARER_TOKEN:tmdb.bearerToken||process.env.TMDB_BEARER_TOKEN};}
const reply=(response,status,body)=>{response.writeHead(status,{"Content-Type":"application/json","Cache-Control":"no-store"});response.end(JSON.stringify(body));};
const server=http.createServer(async(request,response)=>{
  const sourceURL=new URL(request.url,"http://"+(request.headers.host||"localhost"));
  if(sourceURL.pathname.startsWith("/api/")){
    try{
      const chunks=[];let size=0;for await(const chunk of request){size+=chunk.length;if(size>1100000)return reply(response,413,{error:"Request is too large."});chunks.push(chunk);}
      const headers=new Headers();for(const [key,value]of Object.entries(request.headers))if(value!==undefined)headers.set(key,Array.isArray(value)?value.join(","):value);
      // This header comes from the trusted local socket, not a client-supplied proxy header.
      headers.set("CF-Connecting-IP",request.socket.remoteAddress||"local");
      const body=chunks.length?Buffer.concat(chunks):undefined,module=await import("../functions/api/[[path]].js");
      const result=await module.onRequest({request:new Request(sourceURL.href,{method:request.method,headers,...(body?{body}:{})}),env:environment(),params:{path:sourceURL.pathname.slice(5)}});
      for(const [key,value]of result.headers)response.setHeader(key,value);
      response.writeHead(result.status);response.end(Buffer.from(await result.arrayBuffer()));
    }catch{return reply(response,503,{error:"The local API service is unavailable."});}
    return;
  }
  let requested;try{requested=decodeURIComponent(sourceURL.pathname).replace(/^[\\/]+/,"");}catch{return reply(response,400,{error:"Invalid path."});}
  if (["dashboard","dashboard/","dashboard/accounts","dashboard/accounts/"].includes(requested)) requested = "dashboard.html";
  if(!requested)requested="index.html";
  const file=path.resolve(root,requested),relative=path.relative(root,file),extension=path.extname(file);
  if(relative.startsWith("..")||path.isAbsolute(relative)||requested.includes("\\")||/(^|\/)[_.]/.test(requested)&&requested!==".well-known/assetlinks.json"||/\.local\.json$|(^|\/)server\.js$|^(tests|qa)\//i.test(requested)||!types[extension])return reply(response,404,{error:"Not found."});
  fs.readFile(file,(error,data)=>{
    if(error)return reply(response,error.code==="ENOENT"?404:500,{error:"Not found."});
    const headers={"Content-Type":types[extension],"Cache-Control":"no-cache"};
    const globalHeaders=fs.readFileSync(path.join(root,"_headers"),"utf8").split(/\r?\n/);let global=false;
    for(const line of globalHeaders){if(!line.trim())continue;if(!/^\s/.test(line)){global=line==="/*";continue;}if(global){const index=line.indexOf(":");if(index>0)headers[line.slice(0,index).trim()]=line.slice(index+1).trim();}}
    response.writeHead(200,headers);response.end(data);
  });
});
const port=process.env.PORT||4174;server.listen(port,"127.0.0.1",()=>console.log("SEVEN is available on port "+port));
