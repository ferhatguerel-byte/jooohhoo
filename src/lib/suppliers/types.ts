export type SupplierOrderItem = {
  supplierVariantId: string
  quantity: number
}

export type SupplierShippingAddress = {
  name: string
  email: string
  phone?: string
  line1: string
  line2?: string
  city: string
  postalCode: string
  country: string
}

export type SupplierOrderRequest = {
  orderId: string
  items: SupplierOrderItem[]
  shipping: SupplierShippingAddress
}

export type SupplierOrderResult = {
  ok: boolean
  supplierOrderId?: string
  error?: string
  mock: boolean
}

export interface Supplier {
  name: string
  createOrder(request: SupplierOrderRequest): Promise<SupplierOrderResult>
  getOrderStatus(supplierOrderId: string): Promise<{ status: string; trackingNumber?: string }>
}
