export type PurchaseOrderStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'FULFILLED';

export interface PurchaseOrderLine {
  productName: string;
  sku: string;
  requestedQuantity: number;
  availableStock: number;
  unitPrice: number;
  unit: string;
}

export interface PurchaseOrderTimelineEvent {
  title: string;
  detail: string;
  occurredAt: string;
  state: 'COMPLETE' | 'CURRENT' | 'UPCOMING';
}

export interface ManufacturerPurchaseOrder {
  id: string;
  distributorName: string;
  destinationHub: string;
  issueDate: string;
  status: PurchaseOrderStatus;
  lines: PurchaseOrderLine[];
  timeline: PurchaseOrderTimelineEvent[];
}
