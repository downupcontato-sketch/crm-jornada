import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Edge Function: monitorar-timers
// Cron recomendado: 0 * * * * (a cada hora)
// Configurar em: Supabase Dashboard → Edge Functions → monitorar-timers → Schedule

Deno.serve(async (_req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  const limite48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('contacts')
    .update({ timer_status: 'feedback_pendente' })
    .eq('timer_status', 'aguardando')
    .eq('fase_pipeline', 'CONTATO_INICIAL')
    .lt('data_aguardando_resposta', limite48h)
    .select('id')

  if (error) {
    console.error('Erro ao atualizar timer_status:', error)
    return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 })
  }

  const atualizados = data?.length ?? 0
  console.log(`monitorar-timers: ${atualizados} contato(s) marcados como feedback_pendente`)

  return new Response(
    JSON.stringify({ ok: true, atualizados }),
    { headers: { 'Content-Type': 'application/json' } },
  )
})
