interface ComposerSubmitState {
  hasContent: boolean;
  isProcessing: boolean;
}

export function canSubmitComposerMessage({
  hasContent,
  isProcessing,
}: ComposerSubmitState): boolean {
  return hasContent && !isProcessing;
}
