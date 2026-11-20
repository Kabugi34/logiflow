import { HttpClient, HttpEvent, HttpEventType } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { Observable, filter, map } from 'rxjs';
import { API_ENDPOINTS } from '../../core/api/api-endpoints';

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  phoneNumber: string | null;
  avatarUrl?: string | null;
  [key: string]: unknown;
}

export interface AvatarUploadState {
  progress: number | null;
  profile?: UserProfile;
}

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly http = inject(HttpClient);
  private readonly currentProfile = signal<UserProfile | null>(null);
  readonly profile = this.currentProfile.asReadonly();

  setProfile(profile: UserProfile): void {
    this.currentProfile.set(profile);
  }

  getMe(): Observable<UserProfile> {
    return this.http.get<UserProfile>(API_ENDPOINTS.users.me).pipe(
      map(profile => {
        this.setProfile(profile);
        return profile;
      }),
    );
  }

  uploadAvatar(file: File): Observable<AvatarUploadState> {
    const body = new FormData();
    body.append('avatar', file);
    return this.http.post<UserProfile>(API_ENDPOINTS.users.meAvatar, body, {
      observe: 'events',
      reportProgress: true,
    }).pipe(
      filter((event: HttpEvent<UserProfile>) =>
        event.type === HttpEventType.UploadProgress || event.type === HttpEventType.Response,
      ),
      map((event) => event.type === HttpEventType.UploadProgress
        ? { progress: event.total ? Math.round((event.loaded / event.total) * 100) : null }
        : { progress: 100, profile: event.body ?? undefined }),
    );
  }
}
