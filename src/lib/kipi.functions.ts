import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { z } from "zod";
import { KIPI_SOURCE, KIPI_START_YEAR, officialFileUrl } from "./ip-verification";

export const journalCoverage = createServerFn({ method: "GET" }).handler(async () => {
  const url=process.env["SUPABASE_URL"],key=process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Journal catalogue is unavailable.");
  const client=createClient<Database>(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>{const headers=new Headers(init?.headers);if(key.startsWith("sb_")&&headers.get("Authorization")===`Bearer ${key}`)headers.delete("Authorization");headers.set("apikey",key);return fetch(input,{...init,headers});}}});
  const [journals,sync,pages,records]=await Promise.all([
    client.from("kipi_journals").select("*").order("publication_year",{ascending:false}).order("publication_month",{ascending:false}).limit(600),
    client.from("kipi_sync_runs").select("*").order("started_at",{ascending:false}).limit(1).maybeSingle(),
    client.from("kipi_journals").select("processed_pages"),client.from("kipi_journals").select("indexed_records_count"),
  ]);
  if(journals.error)throw new Error(journals.error.message);
  return {journals:journals.data??[],sync:sync.data,indexedPages:pages.data?.reduce((n,r)=>n+r.processed_pages,0)??0,indexedRecords:records.data?.reduce((n,r)=>n+r.indexed_records_count,0)??0};
});

export const discoverKipiJournals=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).handler(async({context})=>{
  const {data:allowed}=await context.supabase.rpc("has_role",{_user_id:context.userId,_role:"admin"});
  if(!allowed)throw new Error("Administrator MFA required.");
  const {supabaseAdmin}=await import("@/integrations/supabase/client.server");
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
    await supabaseAdmin.from("ip_verification_audit_logs").insert({actor_id:context.userId,action:"kipi.journals_discovered",details:{count:discovered.size,from_year:KIPI_START_YEAR}});
    return {count:discovered.size};
  }catch(error){await supabaseAdmin.from("kipi_sync_runs").update({status:"failed",completed_at:new Date().toISOString(),error_message:error instanceof Error?error.message:"Discovery failed"}).eq("id",run.id);throw error;}
});

export const processKipiJournal=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator((input:unknown)=>z.object({id:z.string().uuid()}).parse(input)).handler(async({data,context})=>{
  const {data:allowed}=await context.supabase.rpc("has_role",{_user_id:context.userId,_role:"admin"});if(!allowed)throw new Error("Administrator MFA required.");
  const {data:claimed,error:claimError}=await context.supabase.rpc("claim_kipi_journal",{p_id:data.id});if(claimError||!claimed)throw new Error("This journal is already being processed.");
  const {supabaseAdmin}=await import("@/integrations/supabase/client.server");
  const {data:journal}=await context.supabase.from("kipi_journals").select("*").eq("id",data.id).single();if(!journal)throw new Error("Journal not found.");
  try{
    if(journal.archive_format!=="pdf"){
      await supabaseAdmin.from("kipi_journals").update({processing_status:"archive_requires_extraction",processing_error:"Extract the official archive and upload an individual PDF. The archive itself has not been searched.",lease_until:null}).eq("id",journal.id);
      return {processed:0,remaining:0,message:"Extract the official archive and upload individual PDFs for indexing."};
    }
    let blob:Blob|null=null;
    if(journal.storage_path){const loaded=await supabaseAdmin.storage.from("ip-verification-private").download(journal.storage_path);blob=loaded.data;}
    if(!blob){
      const response=await fetch(officialFileUrl(journal.source_url),{redirect:"error",signal:AbortSignal.timeout(45000)});
      if(!response.ok)throw new Error(`KIPI download failed (${response.status}).`);
      if(Number(response.headers.get("content-length"))>15*1024*1024)throw new Error("This PDF exceeds 15 MB. Extract smaller individual journals for manual upload.");
      const reader=response.body?.getReader();if(!reader)throw new Error("KIPI returned no document.");let size=0;const chunks:Uint8Array[]=[];
      for(;;){const next=await reader.read();if(next.done)break;size+=next.value.length;if(size>15*1024*1024){await reader.cancel();throw new Error("Journal exceeds 15 MB.");}chunks.push(next.value);}
      const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}blob=new Blob([bytes],{type:"application/pdf"});
    }
    const bytes=new Uint8Array(await blob.arrayBuffer());if(new TextDecoder().decode(bytes.slice(0,5))!=="%PDF-")throw new Error("The official source is not a readable PDF.");
    const digest=await crypto.subtle.digest("SHA-256",bytes);const hash=[...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,"0")).join("");
    const path=journal.storage_path||`journals/${journal.id}/${hash}.pdf`;
    if(!journal.storage_path){const {error}=await supabaseAdmin.storage.from("ip-verification-private").upload(path,bytes,{contentType:"application/pdf",upsert:false});if(error)throw error;}
    const {getDocumentProxy}=await import("unpdf");const {parseJournalPage}=await import("./kipi-parser");const {normalizeNumber}=await import("./ip-verification");
    const pdf=await getDocumentProxy(bytes,{maxImageSize:16000000,isEvalSupported:false});
    if(pdf.numPages>500){await pdf.destroy();throw new Error("Journal exceeds the safe 500-page limit. Upload a smaller individual issue.");}
    const start=journal.processed_pages+1,end=Math.min(start+9,pdf.numPages);let category:"patent"|"utility_model"|"industrial_design"|"trademark"="patent";
    if(start>1){const {data:prev}=await supabaseAdmin.from("kipi_ip_records").select("ip_category").eq("journal_id",journal.id).order("source_page_number",{ascending:false}).limit(1).maybeSingle();if(prev&&["patent","utility_model","industrial_design","trademark"].includes(prev.ip_category))category=prev.ip_category as typeof category;}
    let indexed=0,scanned=0;
    try{for(let pageNumber=start;pageNumber<=end;pageNumber++){
      const page=await pdf.getPage(pageNumber);const content=await page.getTextContent();const text=content.items.map(item=>"str" in item?item.str+(item.hasEOL?"\n":" "):"").join("");
      const parsed=parseJournalPage(text,category);category=parsed.category;if(parsed.requiresOcr)scanned++;
      const pageHash=[...new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(text)))].map(b=>b.toString(16).padStart(2,"0")).join("");
      const {error:pageError}=await supabaseAdmin.from("kipi_journal_pages").upsert({journal_id:journal.id,page_number:pageNumber,extracted_text:text.slice(0,50000),requires_ocr:parsed.requiresOcr,evidence_hash:pageHash},{onConflict:"journal_id,page_number"});if(pageError)throw pageError;
      for(const record of parsed.records){
        const recordHash=[...new Uint8Array(await crypto.subtle.digest("SHA-256",new TextEncoder().encode(`${journal.id}|${pageNumber}|${record.number}|${record.text}`)))].map(b=>b.toString(16).padStart(2,"0")).join("");
        const {error}=await supabaseAdmin.from("kipi_ip_records").upsert({journal_id:journal.id,ip_category:record.category,original_registration_number:record.number,normalized_registration_number:normalizeNumber(record.number),applicant_name:record.applicant,ip_title:record.title,recorded_status:record.status,source_page_number:pageNumber,extracted_text:record.text,extraction_confidence:record.confidence,record_hash:recordHash},{onConflict:"record_hash"});if(error)throw error;indexed++;
      }
    }}finally{await pdf.destroy();}
    const {count}=await supabaseAdmin.from("kipi_ip_records").select("id",{count:"exact",head:true}).eq("journal_id",journal.id);
    const {count:ocrCount}=await supabaseAdmin.from("kipi_journal_pages").select("id",{count:"exact",head:true}).eq("journal_id",journal.id).eq("requires_ocr",true);
    await supabaseAdmin.from("kipi_journals").update({storage_path:path,file_hash:hash,total_pages:pdf.numPages,processed_pages:end,indexed_records_count:count??0,processing_status:end>=pdf.numPages?(ocrCount?"indexed_with_gaps":"indexed"):"partially_indexed",processing_error:ocrCount?`${ocrCount} pages require OCR or manual review.`:null,lease_until:null}).eq("id",journal.id);
    return {processed:end-start+1,remaining:Math.max(pdf.numPages-end,0),message:`${indexed} record passages indexed; ${scanned} pages in this batch require manual review.`};
  }catch(error){await supabaseAdmin.from("kipi_journals").update({processing_status:"failed",processing_error:error instanceof Error?error.message:"Journal processing failed",lease_until:null}).eq("id",journal.id);throw error;}
});

export const uploadOfficialJournal=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator((input:unknown)=>{if(!(input instanceof FormData))throw new Error("Upload a PDF.");return input;}).handler(async({data,context})=>{
  const {data:allowed}=await context.supabase.rpc("has_role",{_user_id:context.userId,_role:"admin"});if(!allowed)throw new Error("Administrator MFA required.");
  const file=data.get("file"),source=officialFileUrl(String(data.get("source_url")||"")),year=Number(data.get("year"));
  if(!(file instanceof File)||file.size>15*1024*1024||file.size===0||year<KIPI_START_YEAR||year>new Date().getUTCFullYear())throw new Error("Provide an official PDF up to 15 MB, from 2008 onward.");
  const bytes=new Uint8Array(await file.arrayBuffer());if(new TextDecoder().decode(bytes.slice(0,5))!=="%PDF-")throw new Error("The file is not a PDF.");
  const {supabaseAdmin}=await import("@/integrations/supabase/client.server");
  const hash=[...new Uint8Array(await crypto.subtle.digest("SHA-256",bytes))].map(b=>b.toString(16).padStart(2,"0")).join("");
  const path=`journals/manual/${hash}.pdf`;const {data:existing}=await supabaseAdmin.from("kipi_journals").select("id").eq("file_hash",hash).limit(1).maybeSingle();if(existing)return {id:existing.id};
  const {error:storageError}=await supabaseAdmin.storage.from("ip-verification-private").upload(path,bytes,{contentType:"application/pdf",upsert:true});if(storageError)throw storageError;
  const member=file.name.replace(/[^\w. -]/g,"_");
  // Each archive member gets its own provenance URL fragment; the original official archive remains the source.
  const evidenceUrl=`${source.split("#")[0]}#member=${encodeURIComponent(member)}`;
  const {data:row,error}=await supabaseAdmin.from("kipi_journals").insert({journal_title:member,publication_year:year,source_url:evidenceUrl,discovery_url:KIPI_SOURCE,archive_format:"pdf",archive_member:member,storage_path:path,file_hash:hash}).select("id").single();if(error||!row)throw new Error(error?.message||"Could not save journal.");
  await supabaseAdmin.from("ip_verification_audit_logs").insert({actor_id:context.userId,action:"kipi.manual_journal_uploaded",details:{journal_id:row.id,source_url:source,sha256:hash}});return {id:row.id};
});