import { CurrencyPipe } from '@angular/common';
import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';
import { RouterLink } from '@angular/router';
import { AuthenticatedImageComponent } from '../../../../shared/authenticated-image.component';
import { DistributorResellerListingService } from '../reseller-listing.service';
import { EligibleResellerProduct, ResellerListing } from '../reseller-listing.models';

@Component({
  selector: 'app-my-catalogue',
  standalone: true,
  imports: [AuthenticatedImageComponent, CurrencyPipe, RouterLink],
  templateUrl: './my-catalogue.component.html',
})
export class MyCatalogueComponent implements OnInit {
  protected readonly service = inject(DistributorResellerListingService);
  protected readonly listings = signal<ResellerListing[]>([]);
  protected readonly eligibleProducts = signal<EligibleResellerProduct[]>([]);
  protected readonly readyToList = computed(() =>
    this.eligibleProducts().filter(
      (product) =>
        !product.alreadyListed &&
        !this.listings().some((listing) => listing.manufacturerProductId === product.manufacturerProductId),
    ),
  );
  protected readonly loading = signal(false);
  protected readonly error = signal('');

  ngOnInit(): void {
    this.refresh();
  }

  protected refresh(): void {
    this.loading.set(true);
    this.error.set('');
    forkJoin({ listings: this.service.list(), eligible: this.service.eligibleProducts() }).subscribe({
      next: ({ listings, eligible }) => {
        this.listings.set(listings);
        this.eligibleProducts.set(eligible);
        this.loading.set(false);
      },
      error: (error) => {
        this.error.set(error?.error?.message ?? 'Your reseller catalogue could not be loaded.');
        this.loading.set(false);
      },
    });
  }

  protected acceptedQuantity(listing: ResellerListing): number {
    return this.eligibleProducts().find((product) => product.manufacturerProductId === listing.manufacturerProductId)?.acceptedQuantity ?? listing.quantityOnHand;
  }

  protected imageUrl(product: EligibleResellerProduct): string {
    return this.service.productImageUrl(product);
  }
}

