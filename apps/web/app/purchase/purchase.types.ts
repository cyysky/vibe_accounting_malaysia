export interface PurchaseOrder {
  id: string;
  number: string;
  supplierId: string;
  supplierName?: string;
  date: string;
  total: number;
  status: 'OPEN' | 'CLOSED' | 'CANCELLED';
}
