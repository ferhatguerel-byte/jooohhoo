import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/db'

export async function GET(req: NextRequest) {
  const secret = req.headers.get('x-admin-secret')
  if (secret !== process.env.ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const [customers, purchases, revenue, commissions] = await Promise.all([
    db.customer.count(),
    db.purchase.aggregate({ _sum: { amount: true }, where: { status: 'completed' } }),
    db.revenue.findMany({ orderBy: { date: 'desc' }, take: 30 }),
    db.commission.aggregate({ _sum: { commissionAmount: true }, where: { status: 'pending' } }),
  ])

  const planBreakdown = await db.customer.groupBy({
    by: ['plan'],
    _count: { plan: true },
  })

  return NextResponse.json({
    totalCustomers: customers,
    totalRevenue: purchases._sum.amount || 0,
    pendingCommissions: commissions._sum.commissionAmount || 0,
    revenueByDay: revenue,
    planBreakdown,
  })
}
