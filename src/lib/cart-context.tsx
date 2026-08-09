'use client'

import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from 'react'
import { PRODUCTS } from '@/lib/products'

export type CartLine = {
  productId: string
  quantity: number
}

type CartContextValue = {
  lines: CartLine[]
  addItem: (productId: string, quantity?: number) => void
  removeItem: (productId: string) => void
  setQuantity: (productId: string, quantity: number) => void
  clear: () => void
  itemCount: number
  subtotal: number
}

const CartContext = createContext<CartContextValue | null>(null)
const STORAGE_KEY = 'solenza-cart'

let cartState: CartLine[] = []
let initialized = false
const listeners = new Set<() => void>()

function loadFromStorage(): CartLine[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function ensureInitialized() {
  if (!initialized && typeof window !== 'undefined') {
    cartState = loadFromStorage()
    initialized = true
  }
}

function setCartState(next: CartLine[]) {
  cartState = next
  if (typeof window !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cartState))
  }
  listeners.forEach((listener) => listener())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot() {
  ensureInitialized()
  return cartState
}

function getServerSnapshot() {
  return cartState
}

export function CartProvider({ children }: { children: ReactNode }) {
  const lines = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const addItem = (productId: string, quantity = 1) => {
    const existing = cartState.find((l) => l.productId === productId)
    if (existing) {
      setCartState(cartState.map((l) => (l.productId === productId ? { ...l, quantity: l.quantity + quantity } : l)))
    } else {
      setCartState([...cartState, { productId, quantity }])
    }
  }

  const removeItem = (productId: string) => {
    setCartState(cartState.filter((l) => l.productId !== productId))
  }

  const setQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) return removeItem(productId)
    setCartState(cartState.map((l) => (l.productId === productId ? { ...l, quantity } : l)))
  }

  const clear = () => setCartState([])

  const itemCount = useMemo(() => lines.reduce((sum, l) => sum + l.quantity, 0), [lines])

  const subtotal = useMemo(() => {
    return lines.reduce((sum, l) => {
      const product = PRODUCTS.find((p) => p.id === l.productId)
      return sum + (product ? product.price * l.quantity : 0)
    }, 0)
  }, [lines])

  return (
    <CartContext.Provider value={{ lines, addItem, removeItem, setQuantity, clear, itemCount, subtotal }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const ctx = useContext(CartContext)
  if (!ctx) throw new Error('useCart must be used within CartProvider')
  return ctx
}
