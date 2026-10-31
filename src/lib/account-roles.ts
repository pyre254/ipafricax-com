export const accountRoles = [
  { value: "buyer", label: "Buyer", privileges: "Browse assets, make offers and manage your own deals." },
  { value: "rights_holder", label: "Seller / rights holder", privileges: "Upload and manage your own IP assets and submit certificates for review." },
  { value: "verifier", label: "Reviewer", privileges: "Inspect private submissions and approve or reject identities and certificates." },
  { value: "admin", label: "Administrator", privileges: "Review submissions and manage account access across the exchange." },
] as const;

export type AccountRole = typeof accountRoles[number]["value"];