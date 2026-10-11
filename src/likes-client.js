const tokenKey='gloria:anonymous-likes:v1';
export function createLikesClient({api,fetcher=fetch,storage={getItem:key=>globalThis.localStorage.getItem(key),setItem:(key,value)=>globalThis.localStorage.setItem(key,value),removeItem:key=>globalThis.localStorage.removeItem(key)},onChange=()=>{},onBusy=()=>{}}) {
  const states=new Map(),pending=new Set(),uncertain=new Map();let visitorPromise;
  function token(){try{const value=storage.getItem(tokenKey);return /^[a-f0-9]{64}$/.test(value||'')?value:null;}catch{return null;}}
  async function request(path,{method='GET',body,authenticated=false}={}) {
    const headers={};if(body!==undefined)headers['Content-Type']='application/json';
    const value=token();if(value)headers.Authorization='Bearer '+value;
    if(authenticated&&!value)throw new Error('当前浏览器无法保存点赞标识。');
    const res=await fetcher(api+path,{method,headers,credentials:'omit',cache:'no-store',body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000)});
    let data;try{data=await res.json();}catch{throw new Error('暂时无法获取点赞结果。');}
    if(!res.ok){const error=new Error(data.error || '点赞暂时不可用。');error.status=res.status;if(res.status===401){try{storage.removeItem(tokenKey);}catch{}states.clear();}throw error;}
    return data;
  }
  function putState(id,state) {
    if(!Number.isSafeInteger(state.count)||state.count<0||typeof state.liked!=='boolean')throw new Error('点赞结果无效。');
    const value={...state,checkedAt:Date.now()};states.set(id,value);onChange(id,value);
  }
  async function load(ids,force=false) {
    const selected=[...new Set(ids)].filter(id=>force||!states.has(id)||Date.now()-states.get(id).checkedAt>60000);
    for(let i=0;i<selected.length;i+=100){
      const data=await request('/api/counts',{method:'POST',body:{ids:selected.slice(i,i+100)}});
      for(const id of selected.slice(i,i+100)){if(!data.items?.[id])throw new Error('点赞结果不完整。');putState(id,data.items[id]);}
    }
  }
  async function ensureVisitor() {
    if(token())return;
    if(visitorPromise)return visitorPromise;
    visitorPromise=request('/api/visitors',{method:'POST',body:{}}).then(data=>{
      if(!/^[a-f0-9]{64}$/.test(data.token || ''))throw new Error('点赞标识无效。');
      try{storage.setItem(tokenKey,data.token);}catch{throw new Error('当前浏览器无法保存点赞标识，请检查浏览器设置。');}
      if(token()!==data.token)throw new Error('当前浏览器未能保存点赞标识。');
    }).finally(()=>{visitorPromise=null;});return visitorPromise;
  }
  async function toggle(id) {
    if(pending.has(id))return;
    pending.add(id);onBusy(id,true);
    let desired;
    try{
      await ensureVisitor();await load([id],true);
      desired=uncertain.has(id)?uncertain.get(id):!states.get(id).liked;
      const value=await request('/api/likes/'+encodeURIComponent(id),{method:'PUT',body:{liked:desired},authenticated:true});
      putState(id,value);uncertain.delete(id);
    }catch(error){
      if(desired!==undefined&&(!error.status||error.status>=500)){
        uncertain.set(id,desired);
        try{await load([id],true);if(states.get(id).liked===desired){uncertain.delete(id);return;}}catch{}
      }
      throw error;
    }finally{pending.delete(id);onBusy(id,false);}
  }
  async function ranking() {
    const counts=new Map();let after='';
    for(let page=0;page<200;page++){
      const data=await request('/api/ranking'+(after?'?after='+encodeURIComponent(after):''));
      if(!Array.isArray(data.items))throw new Error('点赞排序数据无效。');
      for(const row of data.items){if(!Number.isSafeInteger(row.count)||row.count<0)throw new Error('点赞排序数据无效。');counts.set(row.work_id,row.count);}
      if(!data.nextCursor)return counts;
      if(data.nextCursor===after)throw new Error('点赞排序数据不完整。');after=data.nextCursor;
    }
    throw new Error('点赞排序数据过多，请稍后重试。');
  }
  return {states,pending,load,toggle,ranking};
}
