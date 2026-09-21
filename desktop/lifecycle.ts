export class DesktopLifecycle {
  private quitting = false;

  get isQuitting(): boolean {
    return this.quitting;
  }

  requestWindowClose(hideWindow: () => void): boolean {
    if (this.quitting) return true;
    hideWindow();
    return false;
  }

  quit(stopBackend: () => void): void {
    if (this.quitting) return;
    this.quitting = true;
    stopBackend();
  }

  fail(stopBackend: () => void, shutDownApplication: () => void): void {
    if (this.quitting) return;
    this.quitting = true;
    stopBackend();
    shutDownApplication();
  }
}
