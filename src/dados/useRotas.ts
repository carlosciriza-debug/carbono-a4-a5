import type { Feature, LineString, Position } from 'geojson'
import { useEffect, useMemo, useRef, useState } from 'react'
import { FATORES } from '../compartilhado/fatores'
import type { IdCategoria, Rota } from '../compartilhado/terreno'
import type { PontoComDistancia } from './fornecedores'
import {
  buscarDistancias,
  buscarGeometria,
  chaveCentro,
  type DistanciaEstrada,
  escolherCandidatos,
  escolherRotas,
  ErroRotas,
  linhaReta,
} from './rotas'

const ESPERA_ANTES_DE_CONSULTAR_MS = 700

export type EstadoRotas = { calculando: boolean; erro: string | null }

/**
 * Calcula as rotas por categoria a partir do centro do lote e dos pontos ativos.
 * Distâncias e geometrias ficam em cache por lote: ligar e desligar pontos
 * não refaz consultas já feitas.
 */
export function useRotas(centro: Position | null, pontos: PontoComDistancia[]) {
  // Caches por lote; chave: "centro|ponto".
  const [distancias, setDistancias] = useState(() => new Map<string, DistanciaEstrada>())
  const [geometrias, setGeometrias] = useState(() => new Map<string, Feature<LineString>>())
  const [estado, setEstado] = useState<EstadoRotas>({ calculando: false, erro: null })
  // Evitam pedir o mesmo ponto duas vezes enquanto a primeira consulta não volta.
  const emConsulta = useRef(new Set<string>())
  const geometriaEmConsulta = useRef(new Set<string>())
  const [falhou, setFalhou] = useState<Set<string>>(new Set()) // centros em que o serviço falhou

  const chave = centro ? chaveCentro(centro) : null
  const candidatos = useMemo(() => escolherCandidatos(pontos), [pontos])

  // 1. Distâncias por estrada que ainda faltam para este lote.
  useEffect(() => {
    if (!centro || !chave || falhou.has(chave)) return
    const faltando = candidatos.filter(
      (p) => !distancias.has(`${chave}|${p.id}`) && !emConsulta.current.has(`${chave}|${p.id}`),
    )
    if (faltando.length === 0) return

    // A resposta é sempre guardada, mesmo que os pontos mudem no meio da consulta.
    const espera = setTimeout(async () => {
      const chaves = faltando.map((p) => `${chave}|${p.id}`)
      for (const k of chaves) emConsulta.current.add(k)
      setEstado({ calculando: true, erro: null })
      try {
        const r = await buscarDistancias(centro, faltando)
        setDistancias((atual) => {
          const novo = new Map(atual)
          for (const [id, d] of r) novo.set(`${chave}|${id}`, d)
          return novo
        })
        setEstado({ calculando: false, erro: null })
      } catch (e) {
        setFalhou((f) => new Set(f).add(chave))
        setEstado({ calculando: false, erro: e instanceof ErroRotas ? e.message : 'Erro inesperado nas rotas.' })
      } finally {
        for (const k of chaves) emConsulta.current.delete(k)
      }
    }, ESPERA_ANTES_DE_CONSULTAR_MS)
    return () => clearTimeout(espera)
  }, [centro, chave, candidatos, falhou, distancias])

  // 2. Rota escolhida por categoria (menor distância por estrada).
  const rotasSemGeometria = useMemo(() => {
    if (!chave) return {}
    const doLote = new Map<string, DistanciaEstrada>()
    for (const p of candidatos) {
      const d = distancias.get(`${chave}|${p.id}`)
      if (d) doLote.set(p.id, d)
    }
    // Enquanto as distâncias não chegam, não mostra estimativa; só depois de uma falha.
    if (doLote.size === 0 && !falhou.has(chave)) return {}
    return escolherRotas(candidatos, doLote, FATORES.tortuosidade.valor)
  }, [chave, candidatos, falhou, distancias])

  // 3. Geometria das rotas escolhidas.
  useEffect(() => {
    if (!centro || !chave) return
    const faltando = Object.values(rotasSemGeometria).filter(
      (r) =>
        !r.estimada &&
        !geometrias.has(`${chave}|${r.pontoId}`) &&
        !geometriaEmConsulta.current.has(`${chave}|${r.pontoId}`),
    )
    for (const r of faltando) {
      const ponto = candidatos.find((p) => p.id === r.pontoId)
      if (!ponto) continue
      const k = `${chave}|${r.pontoId}`
      geometriaEmConsulta.current.add(k)
      // As consultas entram na fila de 1 por segundo do módulo de rotas.
      buscarGeometria(centro, ponto.coordenadas)
        .then(({ geometria }) => setGeometrias((atual) => new Map(atual).set(k, geometria)))
        .catch(() => {
          // Sem geometria, a rota aparece como linha reta, mas a distância continua a do OSRM.
        })
        .finally(() => geometriaEmConsulta.current.delete(k))
    }
  }, [centro, chave, rotasSemGeometria, candidatos, geometrias])

  const rotas = useMemo(() => {
    const resultado: Partial<Record<IdCategoria, Rota>> = {}
    if (!centro || !chave) return resultado
    for (const [categoria, r] of Object.entries(rotasSemGeometria) as [IdCategoria, Rota][]) {
      const ponto = candidatos.find((p) => p.id === r.pontoId)
      const geometria = r.estimada ? null : (geometrias.get(`${chave}|${r.pontoId}`) ?? null)
      resultado[categoria] = {
        ...r,
        geometria: geometria ?? (ponto ? linhaReta(ponto.coordenadas, centro) : null),
      }
    }
    return resultado
  }, [centro, chave, rotasSemGeometria, candidatos, geometrias])

  function tentarDeNovo() {
    if (!chave) return
    setFalhou((f) => {
      const novo = new Set(f)
      novo.delete(chave)
      return novo
    })
  }

  return { rotas, estado, tentarDeNovo }
}
