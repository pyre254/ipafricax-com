import { KIPI_SOURCE,KIPI_START_YEAR,officialFileUrl } from "./ip-verification";
export async function discoverOfficialJournals(actorId:string|null=null){
 const {supabaseAdmin}=await import("@/integrations/supabase/client.server");
  await supabaseAdmin.from("kipi_sync_runs").update({status:"failed",error_message:"Discovery lease expired",completed_at:new Date().toISOString()}).eq("status","running").lt("started_at",new Date(Date.now()-300000).toISOString());
  const {data:active}=await supabaseAdmin.from("kipi_sync_runs").select("id").eq("status","running").gt("started_at",new Date(Date.now()-300000).toISOString()).limit(1);
  if(active?.length)throw new Error("Journal discovery is already running.");
  const {data:run,error:runError}=await supabaseAdmin.from("kipi_sync_runs").insert({status:"running"}).select("id").single();
  if(runError||!run)throw new Error("Could not start discovery.");
  try{
    const {load}=await import("cheerio");
    const pending=[KIPI_SOURCE],visited=new Set<string>();
    const discovered=new Map<string,{journal_title:string;publication_year:number;publication_month:number|null;source_url:string;discovery_url:string;archive_format:string}>();
    while(pending.length&&visited.size<8){
      const pageUrl=pending.shift();if(!pageUrl||visited.has(pageUrl))continue;visited.add(pageUrl);
      const response=await fetch(pageUrl,{redirect:"error",headers:{"User-Agent":"IPAfricaExchange/1.0 (+https://ipafricax.com)"},signal:AbortSignal.timeout(30000)});
      if(!response.ok)throw new Error(`KIPI journal page unavailable (${response.status}). Previous evidence has been retained.`);
      const html=await response.text();if(html.length>3000000)throw new Error("KIPI page exceeds safe discovery size.");
      const $=load(html);
      $("a[href]").each((_,element)=>{
        const href=$(element).attr("href");if(!href)return;
        let url:URL;try{url=new URL(href,pageUrl);}catch{return;}
        if(!["www.kipi.go.ke","kipi.go.ke"].includes(url.hostname))return;
        if(url.pathname==="/ip-journal"&&url.searchParams.has("page")&&!visited.has(url.href))pending.push(url.href);
        const format=url.pathname.match(/\.(pdf|zip|rar)$/i)?.[1]?.toLowerCase();if(!format)return;
        try{officialFileUrl(url.href);}catch{return;}
        const title=$(element).closest("tr").text().replace(/\s+/g," ").trim()||$(element).text().trim()||decodeURIComponent(url.pathname.split("/").at(-1)||"");
        const label=`${title} ${decodeURIComponent(url.pathname.split("/").at(-1)||"")}`;
        const year=Number(label.match(/\b(20\d{2})\b/)?.[1]);if(!year||year<KIPI_START_YEAR||year>new Date().getUTCFullYear())return;
        const months=["january","february","march","april","may","june","july","august","september","october","november","december"];
        const month=months.findIndex(m=>new RegExp(`\\b${m}(?:\\b)|\\b${m.slice(0,3)}\\b`,"i").test(label));
        discovered.set(url.href,{journal_title:title.replace(/\s*Download.*$/i,"").replace(/^\d+\s+/,""),publication_year:year,publication_month:month<0?null:month+1,source_url:url.href,discovery_url:pageUrl,archive_format:format});
      });
      if(pending.length)await new Promise(resolve=>setTimeout(resolve,800));
    }
    if(!discovered.size)throw new Error("No journal links were recovered; existing indexed records are unchanged.");
    const {error}=await supabaseAdmin.from("kipi_journals").upsert([...discovered.values()].map(j=>({...j,last_synced_at:new Date().toISOString()})),{onConflict:"source_url"});if(error)throw error;
    const note="Official links discovered from 2008 onward. Annual archive completeness is unconfirmed; only processed PDF pages are searchable. Scanned pages require manual review.";
    await supabaseAdmin.from("kipi_sync_runs").update({status:"completed",completed_at:new Date().toISOString(),discovered_count:discovered.size,coverage_note:note}).eq("id",run.id);
    await supabaseAdmin.from("ip_verification_audit_logs").insert({actor_id:actorId,action:"kipi.journals_discovered",details:{count:discovered.size,from_year:KIPI_START_YEAR}});
    return {count:discovered.size};
  }catch(error){await supabaseAdmin.from("kipi_sync_runs").update({status:"failed",completed_at:new Date().toISOString(),error_message:error instanceof Error?error.message:"Discovery failed"}).eq("id",run.id);throw error;}
}
