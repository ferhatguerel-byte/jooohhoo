import type { Supplier, SupplierOrderRequest, SupplierOrderResult } from './types'

const CJ_API_BASE = 'https://developers.cjdropshipping.com/api2.0/v1'

const CJ_EMAIL = process.env.CJ_API_EMAIL
const CJ_KEY = process.env.CJ_API_KEY

let cachedToken: { accessToken: string; expiresAt: number } | null = null

async function getAccessToken(): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.accessToken
  }
  const res = await fetch(`${CJ_API_BASE}/authentication/getAccessToken`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: CJ_EMAIL, password: CJ_KEY }),
  })
  if (!res.ok) {
    throw new Error(`CJ auth failed: ${res.status} ${await res.text()}`)
  }
  const data = await res.json()
  const accessToken = data?.data?.accessToken
  if (!accessToken) {
    throw new Error(`CJ auth response missing accessToken: ${JSON.stringify(data)}`)
  }
  cachedToken = {
    accessToken,
    expiresAt: Date.now() + 1000 * 60 * 60 * 12,
  }
  return accessToken
}

async function createOrderReal(request: SupplierOrderRequest): Promise<SupplierOrderResult> {
  try {
    const accessToken = await getAccessToken()
    const res = await fetch(`${CJ_API_BASE}/shopping/order/createOrder`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'CJ-Access-Token': accessToken,
      },
      body: JSON.stringify({
        orderNumber: request.orderId,
        shippingZip: request.shipping.postalCode,
        shippingCountryCode: request.shipping.country,
        shippingCountry: request.shipping.country,
        shippingProvince: request.shipping.city,
        shippingCity: request.shipping.city,
        shippingAddress: request.shipping.line1,
        shippingAddress2: request.shipping.line2 || '',
        shippingCustomerName: request.shipping.name,
        shippingPhone: request.shipping.phone || '',
        email: request.shipping.email,
        products: request.items.map((item) => ({
          vid: item.supplierVariantId,
          quantity: item.quantity,
        })),
      }),
    })
    const data = await res.json()
    if (!res.ok || data?.result === false) {
      return { ok: false, error: data?.message || `HTTP ${res.status}`, mock: false }
    }
    return { ok: true, supplierOrderId: data?.data?.orderId, mock: false }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err), mock: false }
  }
}

async function createOrderMock(request: SupplierOrderRequest): Promise<SupplierOrderResult> {
  const supplierOrderId = `MOCK-CJ-${request.orderId.slice(0, 8)}`
  console.log(
    `[CJ Dropshipping MOCK] Kein CJ_API_EMAIL/CJ_API_KEY hinterlegt — simuliere Bestellung ${supplierOrderId} für Order ${request.orderId} ` +
      `(${request.items.length} Artikel an ${request.shipping.city}, ${request.shipping.country}). ` +
      `Trage echte Zugangsdaten in .env.local ein, um live an CJ Dropshipping zu bestellen.`
  )
  return { ok: true, supplierOrderId, mock: true }
}

export const cjDropshipping: Supplier = {
  name: 'CJ Dropshipping',

  async createOrder(request: SupplierOrderRequest): Promise<SupplierOrderResult> {
    if (!CJ_EMAIL || !CJ_KEY) {
      return createOrderMock(request)
    }
    return createOrderReal(request)
  },

  async getOrderStatus(supplierOrderId: string) {
    if (supplierOrderId.startsWith('MOCK-CJ-')) {
      return { status: 'mock_pending' }
    }
    const accessToken = await getAccessToken()
    const res = await fetch(`${CJ_API_BASE}/shopping/order/getOrderDetail?orderId=${encodeURIComponent(supplierOrderId)}`, {
      headers: { 'CJ-Access-Token': accessToken },
    })
    const data = await res.json()
    return {
      status: data?.data?.orderStatus || 'unknown',
      trackingNumber: data?.data?.trackNumber,
    }
  },
}
