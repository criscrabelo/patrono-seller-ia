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

  const { filename, contentType, size } = await req.json()

  const isVideo = (contentType as string)?.startsWith('video/')
  const maxSize = isVideo ? 500 * 1024 * 1024 : 10 * 1024 * 1024
  if (size > maxSize) {
    return NextResponse.json(
      { error: `Arquivo muito grande. Máximo: ${isVideo ? '500MB' : '10MB'}` },
      { status: 400 }
    )
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceKey)

  const ext = (filename as string).split('.').pop() ?? 'bin'
  const bucket = isVideo ? 'videos' : 'imagens'
  const path = `${session.user.id}/${Date.now()}.${ext}`

  const { data, error } = await supabaseAdmin.storage.from(bucket).createSignedUploadUrl(path)

  if (error) {
    return NextResponse.json({ error: `Erro ao gerar URL de upload: ${error.message}` }, { status: 500 })
  }

  const { data: urlData } = supabaseAdmin.storage.from(bucket).getPublicUrl(path)

  return NextResponse.json({
    uploadUrl: data.signedUrl,
    publicUrl: urlData.publicUrl,
  })
}
