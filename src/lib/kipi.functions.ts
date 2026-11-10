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
  const {discoverOfficialJournals}=await import("./kipi.server");
  return discoverOfficialJournals(context.userId);
});

export const processKipiJournal=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator((input:unknown)=>z.object({id:z.string().uuid()}).parse(input)).handler(async({data,context})=>{
  const {data:allowed}=await context.supabase.rpc("has_role",{_user_id:context.userId,_role:"admin"});if(!allowed)throw new Error("Administrator MFA required.");
  const {indexOfficialJournal}=await import("./kipi-processing.server");
  return indexOfficialJournal(data.id);
});

export const uploadOfficialJournal=createServerFn({method:"POST"}).middleware([requireSupabaseAuth]).inputValidator((input:unknown)=>{if(!(input instanceof FormData))throw new Error("Upload a PDF.");return input;}).handler(async({data,context})=>{
  const {data:allowed}=await context.supabase.rpc("has_role",{_user_id:context.userId,_role:"admin"});if(!allowed)throw new Error("Administrator MFA required.");
  const file=data.get("file"),source=officialFileUrl(String(data.get("source_url")||"")),year=Number(data.get("year"));
  if(!(file instanceof File)||file.size>15*1024*1024||file.size===0||year<KIPI_START_YEAR||year>new Date().getUTCFullYear())throw new Error("Provide an official PDF up to 15 MB, from 2008 onward.");
  const bytes=new Uint8Array(await file.arrayBuffer());if(new TextDecoder().decode(bytes.slice(0,5))!=="%PDF-")throw new Error("The file is not a PDF.");
  const {supabaseAdmin}=await import("@/integrations/supabase/client.server");
  const hash=[...new Uint8Array(await crypto.subtle.digest("SHA-256",bytes))].map(b=>b.toString(16).padStart(2,"0")).join("");
  let officialMember:string|null=null;
  if(source.toLowerCase().split("#")[0].endsWith(".rar")){
    const {default:manifest}=await import("./kipi-2008-manifest.json");
    const match=manifest.find(m=>m.source===source.split("#")[0]&&m.sha256===hash);if(!match||year!==2008)throw new Error("This archive member has not been authenticated against the official archive. Use a direct official PDF URL or the authenticated 2008 members.");officialMember=match.member;
  }else{
    const response=await fetch(source,{redirect:"error",signal:AbortSignal.timeout(45000)});if(!response.ok||Number(response.headers.get("content-length"))>15*1024*1024)throw new Error("Official PDF could not be independently checked.");
    const officialBytes=new Uint8Array(await response.arrayBuffer());if(officialBytes.length>15*1024*1024)throw new Error("Official PDF exceeds safe size.");
    const officialHash=[...new Uint8Array(await crypto.subtle.digest("SHA-256",officialBytes))].map(b=>b.toString(16).padStart(2,"0")).join("");if(hash!==officialHash)throw new Error("Uploaded PDF does not match the official KIPI file.");
  }
  const path=`journals/manual/${hash}.pdf`;const {data:existing}=await supabaseAdmin.from("kipi_journals").select("id").eq("file_hash",hash).limit(1).maybeSingle();if(existing)return {id:existing.id};
  const {error:storageError}=await supabaseAdmin.storage.from("ip-verification-private").upload(path,bytes,{contentType:"application/pdf",upsert:true});if(storageError)throw storageError;
  const member=officialMember||file.name.replace(/[^\w. -]/g,"_");
  // Each archive member gets its own provenance URL fragment; the original official archive remains the source.
  const evidenceUrl=`${source.split("#")[0]}#member=${encodeURIComponent(member)}`;
  const {data:row,error}=await supabaseAdmin.from("kipi_journals").insert({journal_title:member,publication_year:year,source_url:evidenceUrl,discovery_url:KIPI_SOURCE,archive_format:"pdf",archive_member:member,storage_path:path,file_hash:hash}).select("id").single();if(error||!row)throw new Error(error?.message||"Could not save journal.");
  await supabaseAdmin.from("ip_verification_audit_logs").insert({actor_id:context.userId,action:"kipi.manual_journal_uploaded",details:{journal_id:row.id,source_url:source,sha256:hash}});return {id:row.id};
});