import { Injectable, signal, computed } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class GlobalLoaderService {
  private inFlightRequests = signal(0);
  isLoading = computed(() => this.inFlightRequests() > 0);

  show(): void {
    this.inFlightRequests.update((count) => count + 1);
  }

  hide(): void {
    this.inFlightRequests.update((count) => Math.max(0, count - 1));
  }
}
