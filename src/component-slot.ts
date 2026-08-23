export class ComponentSlot<T> {
  private current: T | null = null;

  constructor(private readonly dispose: (value: T) => void) {}

  replace(next: T): void {
    if (this.current !== null) this.dispose(this.current);
    this.current = next;
  }

  discard(value: T): void {
    if (this.current === value) this.current = null;
    this.dispose(value);
  }

  clear(): void {
    if (this.current === null) return;
    const current = this.current;
    this.current = null;
    this.dispose(current);
  }
}
