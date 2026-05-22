import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session) return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json(
      { error: 'Configuração de storage ausente. Verifique as variáveis NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.' },
      { status: 500 }
    )
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey)

  const formData = await req.formData()
  const file = formData.get('file') as File | null

  if (!file) return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 })

  const maxSize = file.type.startsWith('video/') ? 100 * 1024 * 1024 : 10 * 1024 * 1024
  if (file.size > maxSize) {
    return NextResponse.json(
      { error: `Arquivo muito grande. Máximo: ${file.type.startsWith('video/') ? '100MB' : '10MB'}` },
      { status: 400 }
    )
  }

  const ext = file.name.split('.').pop()
  const bucket = file.type.startsWith('video/') ? 'videos' : 'imagens'
  const path = `${session.user.id}/${Date.now()}.${ext}`

  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  const { data, error } = await supabaseAdmin.storage.from(bucket).upload(path, buffer, {
    contentType: file.type,
    upsert: false,
  })

  if (error) {
    return NextResponse.json({ error: `Upload falhou: ${error.message}` }, { status: 500 })
  }

  const { data: urlData } = supabaseAdmin.storage.from(bucket).getPublicUrl(data.path)
  return NextResponse.json({ url: urlData.publicUrl })
}
