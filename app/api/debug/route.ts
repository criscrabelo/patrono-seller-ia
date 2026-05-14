import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const results: Record<string, unknown> = {
    DATABASE_URL: process.env.DATABASE_URL ? 'SET (' + process.env.DATABASE_URL.substring(0, 30) + '...)' : 'NOT SET',
    NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET ? 'SET' : 'NOT SET',
    NEXTAUTH_URL: process.env.NEXTAUTH_URL || 'NOT SET',
  }

  try {
    const count = await prisma.user.count()
    results.db = `OK - ${count} users found`
  } catch (e: unknown) {
    results.db = `ERROR: ${e instanceof Error ? e.message : String(e)}`
  }

  return NextResponse.json(results)
}
