import { createFileRoute,Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { queryOptions,useSuspenseQuery } from "@tanstack/react-query";
import { pageMeta } from "@/lib/page-meta";
import { SiteNav } from "@/components/site-nav";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { BriefcaseBusiness,Mail,Plus } from "lucide-react";
const publicServices=createServerFn({method:"GET"}).handler(async()=>{const url=process.env["SUPABASE_URL"],key=process.env["SUPABASE_PUBLISHABLE_KEY"];if(!url||!key)throw new Error("Service directory unavailable.");const client=createClient<Database>(url,key,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:(input,init)=>{const headers=new Headers(init?.headers);if(key.startsWith("sb_")&&headers.get("Authorization")===`Bearer ${key}`)headers.delete("Authorization");headers.set("apikey",key);return fetch(input,{...init,headers});}}});const {data,error}=await client.from("service_listings").select("id,title,profession,description,organization,contact_email").eq("status","approved").limit(100);if(error)throw new Error("Cannot load professional services.");return data??[];});
const options=queryOptions({queryKey:["public-services"],queryFn:()=>publicServices()});
export const Route=createFileRoute("/services")({head:()=>pageMeta("IP professional services","Find approved IP valuers, lawyers and advisers across Kenya and Africa."),loader:({context})=>context.queryClient.ensureQueryData(options),component:Services});
function Services() {
  const { data } = useSuspenseQuery(options);
  const { user } = useAuth();
  return <><SiteNav /><main className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
    <div className="flex flex-wrap items-center justify-between gap-5">
      <div className="min-w-0"><p className="text-xs uppercase tracking-widest text-primary">Kenya · Africa</p><h1 className="mt-3 font-display text-3xl font-semibold">IP professional services</h1></div>
      <Button asChild>{user
        ? <Link to="/services/new"><Plus />List your service</Link>
        : <Link to="/auth" search={{ mode: "signin", next: "list-service" }}><Plus />Sign in to list a service</Link>
      }</Button>
    </div>
    {data.length > 0 ? <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{data.map(s => <article key={s.id} className="min-w-0 rounded-lg border border-border bg-card p-6">
      <BriefcaseBusiness className="h-7 w-7 text-primary" /><p className="mt-5 text-xs uppercase text-primary">{s.profession.replace(/_/g, " ")}</p>
      <h2 className="mt-2 break-words text-lg font-semibold">{s.title}</h2><p className="mt-2 break-words text-xs text-muted-foreground">{s.organization}</p>
      <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-relaxed">{s.description}</p>
      {s.contact_email && <a href={`mailto:${s.contact_email}`} className="mt-5 flex items-center gap-2 break-all text-sm text-primary"><Mail className="h-4 w-4 shrink-0" />{s.contact_email}</a>}
    </article>)}</div> : <div className="mt-10 border-y border-dashed border-border py-12 text-center">
      <BriefcaseBusiness className="mx-auto mb-4 h-9 w-9 text-muted-foreground" />
      <h2 className="text-lg font-semibold">No approved services currently available</h2>
      <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">Professional services appear here after administrator approval and while their visibility period is active.</p>
    </div>}
  </main></>;
}