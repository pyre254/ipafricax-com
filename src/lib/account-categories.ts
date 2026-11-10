import { professions } from "@/lib/listing-visibility";

// Profile categories describe the account; they never grant access roles.
export const accountCategoryGroups = [
  {
    label: "Individuals & organizations",
    options: [
      { value: "inventor", label: "Independent inventor" },
      { value: "startup", label: "Startup" },
      { value: "university", label: "University / TTO" },
      { value: "corporate", label: "Corporate" },
      { value: "law_firm", label: "Law firm / Agent" },
    ],
  },
  { label: "Professionals", options: professions },
] as const;