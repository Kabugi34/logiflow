import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { AuthService } from '../core/auth/auth.service';
import { API_CONFIG } from '../core/api/api.config';
import { API_ENDPOINTS } from '../core/api/api-endpoints';

@Component({
  selector: 'app-authenticated-image',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (imageUrl(); as url) {
      <img [src]="url" [alt]="alt()" class="h-full w-full" [class.object-cover]="fit() === 'cover'" [class.object-contain]="fit() === 'contain'">
    } @else {
      <span class="grid h-full w-full place-items-center bg-slate-50 px-1 text-center text-xs font-semibold text-slate-400">{{ failed() ? fallback() : 'Loading…' }}</span>
    }
  `,
  host: {
    class: 'block overflow-hidden',
  },
})
export class AuthenticatedImageComponent {
  private static readonly imageCache = new Map<string, { token: string | null; image: Blob }>();
  private static readonly maxCachedImages = 24;
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  readonly src = input.required<string>();
  readonly alt = input.required<string>();
  readonly fallback = input('Image unavailable');
  readonly fit = input<'contain' | 'cover'>('contain');
  protected readonly imageUrl = signal('');
  protected readonly failed = signal(false);

  constructor() {
    effect((onCleanup) => {
      const source = this.src();
      this.imageUrl.set('');
      this.failed.set(false);
      if (!source) {
        this.failed.set(true);
        return;
      }

      let url: URL;
      try {
        url = new URL(source, API_ENDPOINTS.manufacturer.products);
      } catch {
        this.failed.set(true);
        return;
      }

      if (url.origin !== new URL(API_CONFIG.baseUrl).origin) {
        this.imageUrl.set(url.href);
        return;
      }

      const token = this.auth.accessToken;
      const cachedImage = AuthenticatedImageComponent.imageCache.get(url.href);
      if (cachedImage?.token === token) {
        AuthenticatedImageComponent.imageCache.delete(url.href);
        AuthenticatedImageComponent.imageCache.set(url.href, cachedImage);
        const objectUrl = URL.createObjectURL(cachedImage.image);
        this.imageUrl.set(objectUrl);
        onCleanup(() => URL.revokeObjectURL(objectUrl));
        return;
      }
      const headers = token ? new HttpHeaders({ Authorization: `Bearer ${token}` }) : undefined;
      let objectUrl = '';
      const request = this.http.get(url.href, { headers, responseType: 'blob' }).subscribe({
        next: (image) => {
          if (!image.type.startsWith('image/')) {
            this.failed.set(true);
            return;
          }
          AuthenticatedImageComponent.imageCache.delete(url.href);
          AuthenticatedImageComponent.imageCache.set(url.href, { token, image });
          if (AuthenticatedImageComponent.imageCache.size > AuthenticatedImageComponent.maxCachedImages) {
            const oldestUrl = AuthenticatedImageComponent.imageCache.keys().next().value;
            if (oldestUrl) AuthenticatedImageComponent.imageCache.delete(oldestUrl);
          }
          objectUrl = URL.createObjectURL(image);
          this.imageUrl.set(objectUrl);
        },
        error: () => this.failed.set(true),
      });

      onCleanup(() => {
        request.unsubscribe();
        if (objectUrl) URL.revokeObjectURL(objectUrl);
      });
    });
  }
}
