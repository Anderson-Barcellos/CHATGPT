import AdmZip from "adm-zip";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createWorkspaceArchive,
  extractWorkspaceArchive,
  installWorkspaceFromBuffer,
  installWorkspaceFromTemplate,
  replaceWorkspaceContent,
  sanitizeArchiveSlug,
} from "@/lib/server/studioWorkspaceZip";

let root: string;
let staging: string;

beforeEach(async () => {
  root = await mkdtemp(path.join(tmpdir(), "studio-zip-root-"));
  staging = await mkdtemp(path.join(tmpdir(), "studio-zip-staging-"));
});

afterEach(async () => {
  await rm(root, { recursive: true, force: true });
  await rm(staging, { recursive: true, force: true });
});

describe("sanitizeArchiveSlug", () => {
  it("normalizes names into safe slugs", () => {
    expect(sanitizeArchiveSlug("Meu Projeto de Agentes!")).toBe(
      "meu-projeto-de-agentes"
    );
    expect(sanitizeArchiveSlug("agente_v2")).toBe("agente_v2");
  });

  it("rejects names that reduce to nothing", () => {
    expect(sanitizeArchiveSlug("///..///")).toBeNull();
    expect(sanitizeArchiveSlug("")).toBeNull();
  });
});

describe("createWorkspaceArchive", () => {
  it("preserves content byte for byte on a roundtrip", async () => {
    await writeFile(path.join(root, "main.py"), "print('mate')\n");
    await mkdir(path.join(root, "utils"));
    await writeFile(path.join(root, "utils", "helpers.py"), "x = 1\n");

    const buffer = await createWorkspaceArchive(root);
    const extracted = await extractWorkspaceArchive(buffer, staging);
    expect(extracted.ok).toBe(true);

    const main = await readFile(path.join(staging, "main.py"), "utf8");
    const helper = await readFile(path.join(staging, "utils", "helpers.py"), "utf8");
    expect(main).toBe("print('mate')\n");
    expect(helper).toBe("x = 1\n");
  });

  it("excludes runtime directories from the archive", async () => {
    await writeFile(path.join(root, "main.py"), "print('oi')\n");
    await mkdir(path.join(root, "__pycache__"));
    await writeFile(path.join(root, "__pycache__", "main.pyc"), "lixo");
    await mkdir(path.join(root, ".venv"));
    await writeFile(path.join(root, ".venv", "cfg"), "lixo");

    const buffer = await createWorkspaceArchive(root);
    const names = new AdmZip(buffer).getEntries().map((entry) => entry.entryName);

    expect(names).toContain("main.py");
    expect(names.some((name) => name.includes("__pycache__"))).toBe(false);
    expect(names.some((name) => name.includes(".venv"))).toBe(false);
  });

  it("excludes jail runtime files and directories from the archive", async () => {
    await writeFile(path.join(root, "main.py"), "print('oi')\n");
    await writeFile(path.join(root, ".env"), "X=1\n");
    await mkdir(path.join(root, ".ipython"));
    await writeFile(path.join(root, ".ipython", "history.sqlite"), "lixo");
    await writeFile(path.join(root, ".bash_history"), "ls\n");
    await writeFile(path.join(root, ".gaucho-kernel-b0bfa68a.json"), "{}");

    const buffer = await createWorkspaceArchive(root);
    const names = new AdmZip(buffer).getEntries().map((entry) => entry.entryName);

    expect(names).toContain("main.py");
    expect(names).toContain(".env");
    expect(names.some((name) => name.includes(".ipython"))).toBe(false);
    expect(names).not.toContain(".bash_history");
    expect(names.some((name) => name.startsWith(".gaucho-kernel-"))).toBe(false);
  });
});

// O adm-zip sanitiza "../" no addFile, então o zip-slip real precisa ser
// forjado no buffer: nome de mesmo comprimento trocado byte a byte (o CRC
// do formato zip não cobre o entryName).
function forgeZipSlipBuffer(): Buffer {
  const zip = new AdmZip();
  zip.addFile("ok.py", Buffer.from("x = 1\n"));
  zip.addFile("AA/fuga.py", Buffer.from("malicia\n"));

  const buffer = zip.toBuffer();
  let index = buffer.indexOf("AA/fuga.py");
  while (index !== -1) {
    buffer.write("../fuga.py", index);
    index = buffer.indexOf("AA/fuga.py", index + 1);
  }
  return buffer;
}

function forgeSymlinkBuffer(): Buffer {
  const zip = new AdmZip();
  zip.addFile("atalho", Buffer.from("/etc/passwd"));
  zip.getEntries()[0].header.attr = (0o120777 << 16) >>> 0;
  return zip.toBuffer();
}

describe("extractWorkspaceArchive", () => {
  it("rejects zip-slip entries without touching the target", async () => {
    const result = await extractWorkspaceArchive(forgeZipSlipBuffer(), staging);

    expect(result.ok).toBe(false);
    expect(await readdir(staging)).toEqual([]);
  });

  it("rejects symlink entries", async () => {
    const result = await extractWorkspaceArchive(forgeSymlinkBuffer(), staging);
    expect(result.ok).toBe(false);
  });

  it("rejects archives with too many entries", async () => {
    const zip = new AdmZip();
    for (let index = 0; index < 2_001; index += 1) {
      zip.addFile(`arquivo-${index}.txt`, Buffer.from("x"));
    }

    const result = await extractWorkspaceArchive(zip.toBuffer(), staging);
    expect(result.ok).toBe(false);
  });

  it("rejects archives that extract beyond the size budget", async () => {
    const zip = new AdmZip();
    zip.addFile("gigante.bin", Buffer.alloc(4 * 1024 * 1024, 65));

    const result = await extractWorkspaceArchive(zip.toBuffer(), staging, {
      maxExtractedBytes: 1024 * 1024,
    });

    expect(result.ok).toBe(false);
  });
});

describe("installWorkspaceFromBuffer", () => {
  it("restores a saved archive end to end", async () => {
    await writeFile(path.join(root, "main.py"), "print('original')\n");
    const buffer = await createWorkspaceArchive(root);

    await writeFile(path.join(root, "main.py"), "print('mudado')\n");
    await writeFile(path.join(root, "extra.py"), "sobra\n");

    const result = await installWorkspaceFromBuffer(root, buffer);

    expect(result.ok).toBe(true);
    expect(await readFile(path.join(root, "main.py"), "utf8")).toBe(
      "print('original')\n"
    );
    expect((await readdir(root)).sort()).toEqual(["main.py"]);
  });

  it("leaves the workspace intact when the buffer is malicious", async () => {
    await writeFile(path.join(root, "preservado.py"), "intacto\n");

    const result = await installWorkspaceFromBuffer(root, forgeZipSlipBuffer());

    expect(result.ok).toBe(false);
    expect(await readFile(path.join(root, "preservado.py"), "utf8")).toBe(
      "intacto\n"
    );
  });
});

describe("installWorkspaceFromTemplate", () => {
  it("resets the workspace to the template content", async () => {
    await writeFile(path.join(root, "sujeira.py"), "velho\n");
    const template = await mkdtemp(path.join(tmpdir(), "studio-template-"));
    await writeFile(path.join(template, "main.py"), "print('template')\n");

    const result = await installWorkspaceFromTemplate(root, template);

    expect(result.ok).toBe(true);
    expect((await readdir(root)).sort()).toEqual(["main.py"]);
    expect(await readFile(path.join(root, "main.py"), "utf8")).toBe(
      "print('template')\n"
    );
    await rm(template, { recursive: true, force: true });
  });
});

describe("replaceWorkspaceContent", () => {
  it("replaces the workspace with the staged content", async () => {
    await writeFile(path.join(root, "antigo.py"), "velho\n");
    await writeFile(path.join(staging, "novo.py"), "novo\n");
    await mkdir(path.join(staging, "utils"));
    await writeFile(path.join(staging, "utils", "mod.py"), "m = 1\n");

    const result = await replaceWorkspaceContent(root, staging);

    expect(result.ok).toBe(true);
    const names = await readdir(root);
    expect(names.sort()).toEqual(["novo.py", "utils"]);
    expect(await readFile(path.join(root, "novo.py"), "utf8")).toBe("novo\n");
  });

  it("keeps the workspace intact when extraction fails upstream", async () => {
    await writeFile(path.join(root, "preservado.py"), "intacto\n");

    const extracted = await extractWorkspaceArchive(forgeZipSlipBuffer(), staging);

    expect(extracted.ok).toBe(false);
    expect(await readFile(path.join(root, "preservado.py"), "utf8")).toBe(
      "intacto\n"
    );
  });
});
