import type { ForgeConfig } from "@electron-forge/shared-types";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerZIP } from "@electron-forge/maker-zip";
import { AutoUnpackNativesPlugin } from "@electron-forge/plugin-auto-unpack-natives";
import { VitePlugin } from "@electron-forge/plugin-vite";

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    executableName: "Gaucho Chat",
    // O servidor standalone inteiro fica em resources/.next, fora do asar. Isso
    // mantém os binários nativos acessíveis ao processo Node do Electron.
    extraResource: ["desktop/.next"],
  },
  rebuildConfig: {
    force: true,
    onlyModules: ["better-sqlite3", "@lancedb/lancedb"],
  },
  makers: [new MakerSquirrel({}), new MakerZIP({}, ["win32"])],
  plugins: [
    new VitePlugin({
      build: [
        {
          entry: "desktop/main.ts",
          config: "desktop/vite.main.config.ts",
          target: "main",
        },
        {
          entry: "desktop/preload.ts",
          config: "desktop/vite.preload.config.ts",
          target: "preload",
        },
      ],
      renderer: [],
      // O Next é construído antes do Forge; não há renderer Vite concorrente.
      concurrent: false,
    }),
    new AutoUnpackNativesPlugin({}),
  ],
};

export default config;
