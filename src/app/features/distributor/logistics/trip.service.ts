import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { API_CONFIG } from '../../../core/api/api.config';

export interface TripLocation { name: string; address: string; latitude: number; longitude: number; }
export interface ApiTripStop { id: string; sequence: number; location: TripLocation; status: string; etaLabel: string | null; orderNumber: string | null; contactName: string | null; }
export interface DistributorTrip { id: string; tripNumber: string; type: 'RESTOCK' | 'DELIVERY'; status: 'SCHEDULED' | 'ONGOING' | 'COMPLETED' | 'DELAYED' | 'CANCELLED'; origin: TripLocation; stops: ApiTripStop[]; itemsOnBoard: { id: string; productName: string; brand: string; unitLabel: string; quantity: number }[]; scheduledStartLabel: string | null; totalDistanceKm: number; }
export interface TripDraft { tripType: 'RESTOCK' | 'DELIVERY'; origin: TripLocation; scheduledStartLabel?: string; totalDistanceKm?: number; stops: { sequence: number; location: TripLocation; etaLabel?: string; distanceFromPreviousKm?: number; orderId?: string; stockItemId?: string; restockQuantity?: number; contactName?: string; contactPhone?: string; }[]; }
export interface TripPing { id: number; lat: number; lng: number; recordedAt: string; }
interface ApiPage<T> { content?: T[]; }

@Injectable({ providedIn: 'root' })
export class DistributorTripService {
  private readonly http = inject(HttpClient);
  private readonly tripRecords = signal<DistributorTrip[]>([]);
  private readonly trackingRecords = signal<Record<string, TripPing[]>>({});
  readonly trips = this.tripRecords.asReadonly();
  readonly tracking = this.trackingRecords.asReadonly();
  readonly loading = signal(false);
  readonly error = signal('');
  readonly activeTrips = computed(() => this.tripRecords().filter(trip => ['SCHEDULED', 'ONGOING', 'DELAYED'].includes(trip.status)));

  constructor() { this.refresh(); }
  refresh(): void {
    this.loading.set(true);
    this.http.get<ApiPage<DistributorTrip> | DistributorTrip[]>(`${API_CONFIG.baseUrl}/trips?size=100`).subscribe({
      next: result => { this.tripRecords.set(Array.isArray(result) ? result : result.content ?? []); this.error.set(''); this.loading.set(false); },
      error: error => { this.error.set(error?.error?.message ?? 'Trips could not be loaded.'); this.loading.set(false); }
    });
  }
  findById(id: string): DistributorTrip | undefined { return this.tripRecords().find(trip => trip.id === id); }
  loadTracking(id: string) {
    return this.http.get<TripPing[]>(`${API_CONFIG.baseUrl}/trips/${encodeURIComponent(id)}/tracking`).subscribe({
      next: points => this.trackingRecords.update(rows => ({ ...rows, [id]: points })),
      error: error => this.error.set(error?.error?.message ?? 'Trip tracking could not be loaded.')
    });
  }
  create(draft: TripDraft) { return this.http.post<DistributorTrip>(`${API_CONFIG.baseUrl}/trips`, draft); }
  assignDriver(tripId: string, riderId: string) { return this.http.patch<DistributorTrip>(`${API_CONFIG.baseUrl}/trips/${encodeURIComponent(tripId)}/assign`, { riderId }); }
  updateStatus(tripId: string, status: DistributorTrip['status'], note = '') {
    return this.http.patch<DistributorTrip>(`${API_CONFIG.baseUrl}/trips/${encodeURIComponent(tripId)}/status`, { status, note });
  }
}
