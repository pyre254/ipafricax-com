import {officialFileUrl} from "./ip-verification";
export async function indexOfficialJournal(id:string){
 const {supabaseAdmin}=await import("@/integrations/supabase/client.server");
  const {data:claimed,error:claimError}=await supabaseAdmin.rpc("claim_kipi_journal_internal",{p_id:id});if(claimError||!claimed)throw new Error("This journal is already being processed.");
  const {data:journal}=await supabaseAdmin.from("kipi_journals").select("*").eq("id",id).single();if(!journal)throw new Error("Journal not found.");
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
    const pdf=await getDocumentProxy(bytes,{maxImageSize:16000000});
    if(pdf.numPages>500){await pdf.loadingTask.destroy();throw new Error("Journal exceeds the safe 500-page limit. Upload a smaller individual issue.");}
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
    }}finally{await pdf.loadingTask.destroy();}
    const {count}=await supabaseAdmin.from("kipi_ip_records").select("id",{count:"exact",head:true}).eq("journal_id",journal.id);
    const {count:ocrCount}=await supabaseAdmin.from("kipi_journal_pages").select("id",{count:"exact",head:true}).eq("journal_id",journal.id).eq("requires_ocr",true);
    await supabaseAdmin.from("kipi_journals").update({storage_path:path,file_hash:hash,total_pages:pdf.numPages,processed_pages:end,indexed_records_count:count??0,processing_status:end>=pdf.numPages?(ocrCount?"indexed_with_gaps":"indexed"):"partially_indexed",processing_error:ocrCount?`${ocrCount} pages require OCR or manual review.`:null,lease_until:null}).eq("id",journal.id);
    return {processed:end-start+1,remaining:Math.max(pdf.numPages-end,0),message:`${indexed} record passages indexed; ${scanned} pages in this batch require manual review.`};
  }catch(error){await supabaseAdmin.from("kipi_journals").update({processing_status:"failed",processing_error:error instanceof Error?error.message:"Journal processing failed",lease_until:null}).eq("id",journal.id);throw error;}
}
