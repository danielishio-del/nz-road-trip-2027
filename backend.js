/* Backend do app: Supabase (login, dados em tempo real, anexos).
   Expõe window.claude.use(...) com a mesma interface que o app já usa. */
(function(){
 const SB_URL="https://fryuglgaphugnuxsjahp.supabase.co";
 const SB_KEY="sb_publishable_EzybnSXJGYFvyW4HjtzKXQ_Vbe40j91";
 const sb=window.supabase.createClient(SB_URL,SB_KEY,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
 window.SB=sb;

 /* ---------- sessão ---------- */
 const sessionP=sb.auth.getSession().then(r=>r.data.session).catch(()=>null);
 window.NZ_SESSION=sessionP;

 /* ---------- cache local dos documentos (abre offline) ---------- */
 const CK="nz27docs";
 let cache={}; try{cache=JSON.parse(localStorage.getItem(CK)||"{}")}catch(e){}
 const persist=()=>{try{localStorage.setItem(CK,JSON.stringify(cache))}catch(e){}};
 let confirmed=false;
 const listeners=new Set();
 const snapDoc=(path)=>{const d=cache[path];return{id:path.split("/").pop(),exists:!!d,data:()=>d?d.data:undefined,metadata:{fromCache:!confirmed,hasPendingWrites:false}}};
 const snapCol=(path)=>{const pre=path+"/";const docs=Object.keys(cache).filter(k=>k.startsWith(pre)&&!k.slice(pre.length).includes("/")).sort().map(snapDoc);
  return{docs,size:docs.length,empty:!docs.length,docChanges:()=>[],metadata:{fromCache:!confirmed,hasPendingWrites:false}}};
 const deliver=l=>{try{l.next(l.kind==="doc"?snapDoc(l.path):snapCol(l.path))}catch(e){console.error(e)}};
 const emitAll=()=>listeners.forEach(deliver);

 async function fullLoad(){
  const {data,error}=await sb.from("trip_docs").select("path,data,at");
  if(error) throw error;
  cache={}; (data||[]).forEach(r=>cache[r.path]={data:r.data,at:r.at});
  persist(); confirmed=true; emitAll();
 }
 let started=false;
 function startRealtime(){
  if(started) return; started=true;
  sb.channel("trip_docs").on("postgres_changes",{event:"*",schema:"public",table:"trip_docs"},p=>{
   if(p.eventType==="DELETE"){ if(p.old&&p.old.path) delete cache[p.old.path]; }
   else if(p.new&&p.new.path){ cache[p.new.path]={data:p.new.data,at:p.new.at}; }
   persist(); emitAll();
  }).subscribe(st=>{ if(st==="SUBSCRIBED") fullLoad().catch(()=>{}); });
  fullLoad().catch(()=>{});
  addEventListener("online",()=>fullLoad().catch(()=>{}));
  document.addEventListener("visibilitychange",()=>{ if(!document.hidden) fullLoad().catch(()=>{}); });
 }
 const netErr=e=>{const m=String(e&&e.message||e||"");return /fetch|network|Failed|timeout|offline/i.test(m)?{code:"unavailable",message:m}:{code:"invalid_argument",message:m}};

 function ref(path){
  return {id:path.split("/").pop(),path,
   async get(){return snapDoc(path)},
   async set(d){
    const at=+d.at||Date.now(); cache[path]={data:d,at}; persist(); emitAll();
    const {error}=await sb.from("trip_docs").upsert({path,data:d,at});
    if(error) throw netErr(error);
   },
   async update(d){ return this.set({...(cache[path]?cache[path].data:{}),...d}); },
   async delete(){ delete cache[path]; persist(); emitAll(); const {error}=await sb.from("trip_docs").delete().eq("path",path); if(error) throw netErr(error); },
   onSnapshot(next,err){const l={kind:"doc",path,next,err};listeners.add(l);setTimeout(()=>deliver(l),0);return()=>listeners.delete(l)},
   collection(p){return col(path+"/"+p)}
  };
 }
 function col(path){
  return {path,
   doc(id){return ref(path+"/"+(id||crypto.randomUUID().replace(/-/g,"")))},
   async add(d){const r=this.doc();await r.set(d);return r},
   onSnapshot(next,err){const l={kind:"col",path,next,err};listeners.add(l);setTimeout(()=>deliver(l),0);return()=>listeners.delete(l)},
   async get(){return snapCol(path)}
  };
 }
 const db={doc:ref,collection:col};

 /* ---------- anexos no Storage ---------- */
 const assets={
  async upload(blob,opts){
   const id=crypto.randomUUID().replace(/-/g,"");
   const type=(opts&&opts.type)||blob.type||"application/octet-stream";
   const {error}=await sb.storage.from("anexos").upload(id,blob,{contentType:type,upsert:false});
   if(error){const m=String(error.message||"");throw{code:/size|large/i.test(m)?"too_large":/fetch|network/i.test(m)?"store_unavailable":"upstream_error",message:m}}
   return {id,url:"",sizeBytes:blob.size,contentType:type};
  },
  async delete(id){const {error}=await sb.storage.from("anexos").remove([id]);if(error)throw{code:"upstream_error",message:error.message};return{deleted:true}},
  async list(){return{assets:[],usage:{}}}
 };
 // baixa o anexo uma vez e guarda no aparelho (funciona sem sinal depois)
 window.NZ_FETCH_ASSET=async function(id){
  const {data,error}=await sb.storage.from("anexos").download(id);
  if(error) throw error; return data;
 };

 window.claude={use:async name=>{
  const s=await sessionP; if(!s) return null;
  if(name==="db"){ startRealtime(); return db; }
  if(name==="assets") return assets;
  if(name==="user") return {can:async()=>true,id:async()=>s.user.id};
  return null; // "sample" (Claude) não existe fora do claude.ai
 }};
})();
