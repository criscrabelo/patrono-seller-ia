import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // P2.1: empacotado pelo webpack, o `ffmpeg-static` resolve o caminho do
  // binário a partir da pasta do CHUNK da rota (`.next/server/app/...`), onde
  // ele não existe — o render falhava com "binário não encontrado". Fora do
  // bundle, o pacote é carregado de `node_modules` e acha o próprio binário.
  // Validado no Linux da Netlify: ffmpeg 7.0.2 executou e renderizou.
  serverExternalPackages: ['ffmpeg-static'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
    ],
  },
  // O binário do FFmpeg é referenciado por caminho (ffmpeg-static), e o
  // rastreamento de arquivos do Next não o segue. Sem isto, as rotas que
  // renderizam vídeo sobem sem o binário. Só muda o que entra no pacote da
  // função; não muda comportamento.
  outputFileTracingIncludes: {
    '/api/conteudos/[id]/adicionar-legenda': ['./node_modules/ffmpeg-static/ffmpeg'],
    '/api/conteudos/[id]/gerar-video': ['./node_modules/ffmpeg-static/ffmpeg'],
    '/api/conteudos/[id]/video-status': ['./node_modules/ffmpeg-static/ffmpeg'],
    '/api/digital-twin': ['./node_modules/ffmpeg-static/ffmpeg'],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '110mb',
    },
  },
}

export default nextConfig
