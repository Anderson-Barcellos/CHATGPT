import { contextBridge } from "electron";

// A bridge desta fundação é deliberadamente só de leitura. Configuração de
// chave, arquivos e ações do produto entram nas frentes seguintes.
contextBridge.exposeInMainWorld(
  "gauchoDesktop",
  Object.freeze({
    edition: "desktop" as const,
    isDesktop: true,
  })
);
