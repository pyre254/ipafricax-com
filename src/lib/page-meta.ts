export function pageMeta(title: string, description: string) {
  return { meta: [
    { title: `${title} | IP Africa Exchange` },
    { name: "description", content: description },
    { property: "og:title", content: `${title} | IP Africa Exchange` },
    { property: "og:description", content: description },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary_large_image" },
  ] };
}