import { z } from "zod";
export const RENEWAL_AMOUNT_KES=1000;
export const RENEWAL_DAYS=30;
export const NAIROBI_TIMEZONE="Africa/Nairobi";
export const professions=[{value:"ip_valuer",label:"IP valuer"},{value:"lawyer",label:"Lawyer"},{value:"patent_agent",label:"Patent agent"},{value:"consultant",label:"Consultant"},{value:"other",label:"Other professional"}] as const;
export function renewalExpiry(previous:string,confirmed:string){return new Date(Math.max(Date.parse(previous),Date.parse(confirmed))+RENEWAL_DAYS*86400000).toISOString();}
export function visibilityStatus(expiresAt:string,hidden:boolean,now=Date.now()){return hidden?"Hidden by administrator":Date.parse(expiresAt)<=now?"Suspended":"Active";}
export function reminderDays(period:"introductory"|"paid"){return period==="introductory"?[14,7,3]:[7,3];}
export function nairobiDate(value:string){return new Intl.DateTimeFormat("en-KE",{timeZone:NAIROBI_TIMEZONE,dateStyle:"medium",timeStyle:"short"}).format(new Date(value));}
export const serviceSchema=z.object({title:z.string().trim().min(3).max(200),profession:z.enum(["ip_valuer","lawyer","patent_agent","consultant","other"]),description:z.string().trim().min(30).max(5000),organization:z.string().trim().max(200).optional(),contact_email:z.string().email().max(250)});
export function normalizeMpesaPhone(phone:string){const p=phone.replace(/[\s+()-]/g,"").replace(/^0/,"254");if(!/^254[17]\d{8}$/.test(p))throw new Error("Enter a valid Kenyan M-Pesa mobile number.");return p;}