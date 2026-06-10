const AUDIO_PRIME_SRC =
  "data:audio/wav;base64,UklGRmQBAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YUABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==";

let sharedAudioContext: AudioContext | null = null;

type WebKitAudioWindow = Window &
  typeof globalThis & {
    webkitAudioContext?: typeof AudioContext;
  };

export function getBrowserAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (sharedAudioContext?.state === "closed") sharedAudioContext = null;
  if (sharedAudioContext) return sharedAudioContext;

  const AudioContextConstructor =
    window.AudioContext ?? (window as WebKitAudioWindow).webkitAudioContext;
  if (!AudioContextConstructor) return null;

  sharedAudioContext = new AudioContextConstructor();
  return sharedAudioContext;
}

export async function resumeBrowserAudio(): Promise<AudioContext | null> {
  const context = getBrowserAudioContext();
  if (!context) return null;

  if (context.state === "suspended") {
    await context.resume();
  }

  return context.state === "closed" ? null : context;
}

export async function decodeBrowserAudio(
  arrayBuffer: ArrayBuffer
): Promise<AudioBuffer | null> {
  const context = getBrowserAudioContext();
  if (!context) return null;

  try {
    return await context.decodeAudioData(arrayBuffer.slice(0));
  } catch (error) {
    console.warn("Browser audio decode failed:", error);
    return null;
  }
}

function primeAudioContext(unlockedRef: { current: boolean }) {
  const context = getBrowserAudioContext();
  if (!context) return;

  try {
    const source = context.createBufferSource();
    source.buffer = context.createBuffer(1, 1, context.sampleRate);
    source.connect(context.destination);
    source.start(0);
  } catch {
    // Some browsers consider a source already started if a previous prime raced.
  }

  void context.resume().then(
    () => {
      if (context.state === "running") unlockedRef.current = true;
    },
    (error) => {
      console.warn("Browser AudioContext prime failed:", error);
    }
  );
}

export function primeBrowserAudio(
  audio: HTMLAudioElement | null,
  unlockedRef: { current: boolean }
) {
  if (!audio || unlockedRef.current) return;

  primeAudioContext(unlockedRef);

  const previousSrc = audio.currentSrc || audio.src;
  const previousMuted = audio.muted;
  const previousPreload = audio.preload;
  const previousLoop = audio.loop;
  const previousVolume = audio.volume;

  audio.setAttribute("playsinline", "true");
  audio.muted = false;
  audio.preload = "auto";
  audio.loop = false;
  audio.volume = 1;
  audio.src = AUDIO_PRIME_SRC;

  const restore = (unlocked: boolean) => {
    if (unlocked) unlockedRef.current = true;

    const isStillPriming =
      !audio.srcObject &&
      (audio.src === AUDIO_PRIME_SRC || audio.currentSrc === AUDIO_PRIME_SRC);

    if (isStillPriming) audio.pause();

    audio.muted = previousMuted;
    audio.preload = previousPreload;
    audio.loop = previousLoop;
    audio.volume = previousVolume;

    if (!isStillPriming) return;

    if (previousSrc) {
      audio.src = previousSrc;
    } else {
      audio.removeAttribute("src");
      audio.load();
    }
  };

  void audio.play().then(
    () => restore(true),
    (error) => {
      console.warn("Browser audio prime failed:", error);
      restore(false);
    }
  );
}

export function describeAudioPlayError(
  error: unknown,
  fallback: string
): string {
  if (!error) return fallback;

  if (error instanceof DOMException) {
    if (error.name === "NotAllowedError") {
      return "O navegador bloqueou a reprodução automática. Clique em tocar para liberar o áudio.";
    }
    if (error.name === "NotSupportedError") {
      return "O navegador não conseguiu decodificar esse áudio.";
    }
    return `${fallback} (${error.name})`;
  }

  if (error instanceof Error && error.message.trim()) {
    return `${fallback} (${error.message.trim()})`;
  }

  return fallback;
}
