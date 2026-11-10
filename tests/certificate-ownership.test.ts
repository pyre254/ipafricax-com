import { expect,test } from "bun:test";
import { ownershipDetailsSchema } from "../src/lib/certificate-ownership";
const details={is_certificate:true,registration_number:"KE/P/2008/000123",owner_name:"Société Exemple",certificate_number:null,title:null,issuing_office:"KIPI",document_language:"fr",jurisdiction:"KE",filing_date:"2008-01-31",grant_date:null,expiry_date:null,quality:85,summary:"Printed fields only."};
test("extraction preserves owner accents and registration zeroes",()=>{const parsed=ownershipDetailsSchema.parse(details);expect(parsed.owner_name).toBe("Société Exemple");expect(parsed.registration_number).toBe("KE/P/2008/000123");});
test("an unprinted expiry stays null",()=>expect(ownershipDetailsSchema.parse(details).expiry_date).toBeNull());
test("ambiguous non-ISO dates cannot become saved grant dates",()=>expect(()=>ownershipDetailsSchema.parse({...details,grant_date:"04/05/2008"})).toThrow());