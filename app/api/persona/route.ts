import { promises as fs } from "fs";
import path from "path";
import { NextRequest, NextResponse } from "next/server";

const DATA_DIR = path.join(process.cwd(), "data");
const FILE_PATH = path.join(DATA_DIR, "persona.json");

interface PersonaData {
  contextAboutUser: string;
}

async function ensureFile() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(FILE_PATH);
  } catch {
    await fs.writeFile(
      FILE_PATH,
      JSON.stringify({ contextAboutUser: "" }),
      "utf-8"
    );
  }
}

async function readPersona(): Promise<PersonaData> {
  await ensureFile();
  const raw = await fs.readFile(FILE_PATH, "utf-8");
  try {
    return JSON.parse(raw);
  } catch {
    return { contextAboutUser: "" };
  }
}

async function writePersona(data: PersonaData) {
  await ensureFile();
  await fs.writeFile(FILE_PATH, JSON.stringify(data, null, 2), "utf-8");
}

export async function GET() {
  const data = await readPersona();
  return NextResponse.json(data);
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { contextAboutUser } = body;

  if (typeof contextAboutUser !== "string") {
    return NextResponse.json(
      { error: "contextAboutUser must be a string" },
      { status: 400 }
    );
  }

  const data: PersonaData = { contextAboutUser };
  await writePersona(data);
  return NextResponse.json(data);
}
