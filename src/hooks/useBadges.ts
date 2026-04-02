import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { useAuth } from '@/contexts/AuthContext'
import { calcularSLAFase } from '@/lib/pipeline'

export interface Badges {
  usuariosPendentes: number
  novosCadastros: number
  slaVencidos: number
}

const INITIAL: Badges = { usuariosPendentes: 0, novosCadastros: 0, slaVencidos: 0 }

export function useBadges() {
  const { profile, isAdmin, isCoordenador, isVoluntario, nivel } = useAuth()
  const [badges, setBadges] = useState<Badges>(INITIAL)
  const [realtimeStatus, setRealtimeStatus] = useState<'connecting' | 'connected' | 'error'>('connecting')
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  const fetchBadges = useCallback(async () => {
    if (!profile) return
    if (debounceRef.current) clearTimeout(debounceRef.current)

    debounceRef.current = setTimeout(async () => {
      // 1. Usuários pendentes (admin e coordenador)
      let usuariosPendentes = 0
      if (isAdmin || isCoordenador) {
        let q = supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pendente')
        if (isCoordenador && !isAdmin) {
          q = q.eq('grupo', profile.grupo ?? '').eq('nivel', 'linha_de_frente')
        }
        const { count } = await q
        usuariosPendentes = count ?? 0
      }

      // 2. Novos cadastros pendentes de aprovação
      let novosCadastros = 0
      if (isAdmin || isCoordenador || nivel === 'lider') {
        let q = supabase
          .from('contacts')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pendente_aprovacao')
        if (isCoordenador && !isAdmin && profile.grupo) {
          q = q.eq('grupo', profile.grupo)
        }
        const { count } = await q
        novosCadastros = count ?? 0
      }

      // 3. SLA vencidos (cálculo client-side)
      let slaVencidos = 0
      if (isAdmin || isCoordenador || nivel === 'lider' || isVoluntario) {
        let q = supabase
          .from('contacts')
          .select('id,updated_at,fase_pipeline,voluntario_atribuido_id,grupo')
          .eq('status', 'ativo')
          .in('fase_pipeline', ['CONTATO_INICIAL', 'QUALIFICACAO', 'AULAS', 'POS_AULA'])
        if (nivel === 'voluntario') {
          q = q.eq('voluntario_atribuido_id', profile.id)
        } else if ((nivel === 'coordenador' || nivel === 'lider') && profile.grupo) {
          q = q.eq('grupo', profile.grupo)
        }
        const { data } = await q
        slaVencidos = (data ?? []).filter(c => calcularSLAFase(c as any) === 'over').length
      }

      setBadges({ usuariosPendentes, novosCadastros, slaVencidos })
    }, 300)
  }, [profile, isAdmin, isCoordenador, isVoluntario, nivel])

  // Fetch inicial
  useEffect(() => {
    if (profile) fetchBadges()
  }, [profile, fetchBadges])

  // Supabase Realtime — escuta mudanças nas tabelas profiles e contacts
  useEffect(() => {
    if (!profile) return

    const channel = supabase
      .channel('badges-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => fetchBadges())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'contacts' }, () => fetchBadges())
      .subscribe(status => {
        if (status === 'SUBSCRIBED') setRealtimeStatus('connected')
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') setRealtimeStatus('error')
      })

    return () => { supabase.removeChannel(channel) }
  }, [profile, fetchBadges])

  const totalPendentes = badges.usuariosPendentes + badges.novosCadastros + badges.slaVencidos

  return { badges, totalPendentes, realtimeStatus }
}
