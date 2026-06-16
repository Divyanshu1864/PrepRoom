import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function unescapeHtml(str: string): string {
  return str
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&amp;/g, "&");
}

async function main() {
  console.log("Fetching all problems from the database...");
  const problems = await prisma.problem.findMany();
  console.log(`Found ${problems.length} problems to examine.`);

  let updatedCount = 0;

  for (const p of problems) {
    // If it contains escaped tags, we decode it
    if (p.description.includes("&lt;") || p.description.includes("&gt;")) {
      const decodedDescription = unescapeHtml(p.description);
      await prisma.problem.update({
        where: { id: p.id },
        data: { description: decodedDescription },
      });
      console.log(`Successfully decoded description for problem: "${p.title}"`);
      updatedCount++;
    }
  }

  console.log(`Database cleanup completed! Decoded ${updatedCount} problems.`);
}

main()
  .catch((e) => {
    console.error("Failed to decode problems:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
