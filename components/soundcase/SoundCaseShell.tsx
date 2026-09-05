"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ProductNav } from "@/components/navigation/ProductNav";
import { SoundCaseRealtimeProvider } from "@/components/soundcase/SoundCaseRealtimeProvider";
import { SoundCaseWorkspace } from "@/components/soundcase/SoundCaseWorkspace";
import styles from "./SoundCase.module.css";

export { prepareSoundCaseRealtimeGeneration } from "@/components/soundcase/SoundCaseWorkspace";

export function SoundCaseShell() {
  return (
    <SoundCaseRealtimeProvider>
      <div className={styles.shell}>
        <header className={styles.header}>
          <Link href="/" className={styles.backToChat} aria-label="Voltar ao Chat">
            <ArrowLeft />
          </Link>
          <div className={styles.brand}><span />Gaucho SoundCase</div>
          <ProductNav active="soundcase" />
        </header>
        <SoundCaseWorkspace variant="page" />
      </div>
    </SoundCaseRealtimeProvider>
  );
}
