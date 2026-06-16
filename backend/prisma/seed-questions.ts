import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

async function main() {
  const filePath = path.join(__dirname, "../../leetcode_questions.json");
  console.log(`Reading leetcode_questions.json from: ${filePath}`);

  if (!fs.existsSync(filePath)) {
    console.error(`Error: File not found at ${filePath}`);
    process.exit(1);
  }

  const rawData = fs.readFileSync(filePath, "utf-8");
  console.log("Parsing JSON data...");
  const parsed = JSON.parse(rawData);

  if (!Array.isArray(parsed)) {
    console.error("Error: LeetCode questions file must contain an array of questions.");
    process.exit(1);
  }

  console.log(`Total raw items found: ${parsed.length}`);

  const uniqueQuestions = new Map<string, {
    questionId: string;
    title: string;
    description: string;
    difficulty: string;
  }>();

  for (const item of parsed) {
    const q = item?.data?.question;
    if (!q) continue;
    if (q.isPaidOnly === true) continue;
    if (!q.content || !q.title || !q.difficulty) continue;

    uniqueQuestions.set(q.questionId, {
      questionId: q.questionId,
      title: q.title,
      description: q.content,
      difficulty: q.difficulty,
    });
  }

  const finalQuestions = Array.from(uniqueQuestions.values());
  console.log(`Filtered down to ${finalQuestions.length} free, valid questions for import.`);

  console.log("Clearing existing QuestionBank contents...");
  await prisma.questionBank.deleteMany({});

  const chunkSize = 500;
  console.log(`Starting bulk insertion in chunks of ${chunkSize}...`);

  for (let i = 0; i < finalQuestions.length; i += chunkSize) {
    const chunk = finalQuestions.slice(i, i + chunkSize);
    await prisma.questionBank.createMany({
      data: chunk,
      skipDuplicates: true,
    });
    console.log(`Inserted questions ${i + 1} to ${Math.min(i + chunkSize, finalQuestions.length)}...`);
  }

  console.log("Seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("Seeding failed with error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
