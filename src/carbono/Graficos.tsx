import { useState } from 'react'
import { CATEGORIA_POR_ID } from '../compartilhado/categorias'
import type { IdSistema, ResultadoSistema } from '../compartilhado/terreno'
import type { Sistema } from './calculo'
import { emUnidade, formatarCarbono, totalA4A5, type Unidade } from './resultado'

// Gráficos em SVG próprio. Um eixo por gráfico: A4/A5 têm escala própria;
// a comparação com A1–A3 fica num segundo gráfico, na mesma escala dele.

const LARGURA = 340
const ROTULO = 92
const BARRA = 14
const VAO = 2 // espaço entre segmentos

type Segmento = { rotulo: string; kg: number; cor: string; hachura?: boolean }

type Linha = { sistema: Sistema; modulo: 'A4' | 'A5'; segmentos: Segmento[]; total: number | null; parcial: boolean }

function segmentosA4(r: ResultadoSistema): Segmento[] {
  return r.detalhamento
    .filter((d) => d.modulo === 'A4' && d.kgCO2e !== null && d.kgCO2e > 0)
    .map((d) => ({ rotulo: d.material, kg: d.kgCO2e!, cor: CATEGORIA_POR_ID[d.categoria].cor }))
}

function segmentosA5(r: ResultadoSistema): Segmento[] {
  const cor = CATEGORIA_POR_ID.residuos.cor
  const lista: Segmento[] = []
  if (r.a5ResiduosKgCO2e) lista.push({ rotulo: 'Resíduos', kg: r.a5ResiduosKgCO2e, cor })
  if (r.a5TerraKgCO2e) lista.push({ rotulo: 'Movimento de terra', kg: r.a5TerraKgCO2e, cor, hachura: true })
  return lista
}

type DicaEstado = { x: number; y: number; texto: string } | null

function Dica({ dica }: { dica: DicaEstado }) {
  if (!dica) return null
  return (
    <div className="dica-grafico" style={{ left: dica.x, top: dica.y }} role="status">
      {dica.texto}
    </div>
  )
}

function Hachura({ id, cor }: { id: string; cor: string }) {
  return (
    <pattern id={id} patternUnits="userSpaceOnUse" width="6" height="6" patternTransform="rotate(45)">
      <rect width="6" height="6" fill="var(--fundo)" />
      <line x1="0" y1="0" x2="0" y2="6" stroke={cor} strokeWidth="3" />
    </pattern>
  )
}

type Props = {
  sistemas: Sistema[]
  resultados: ResultadoSistema[]
  unidade: Unidade
  areaM2: number
  destaque: IdSistema | null
}

export function GraficoA4A5({ sistemas, resultados, unidade, areaM2, destaque }: Props) {
  const [dica, setDica] = useState<DicaEstado>(null)
  const linhas: Linha[] = sistemas.flatMap((s, i) => {
    const r = resultados[i]
    return [
      { sistema: s, modulo: 'A4', segmentos: segmentosA4(r), total: r.a4KgCO2e, parcial: r.pendencias.length > 0 },
      { sistema: s, modulo: 'A5', segmentos: segmentosA5(r), total: r.a5KgCO2e, parcial: r.pendencias.length > 0 },
    ] satisfies Linha[]
  })
  const maximo = Math.max(1e-9, ...linhas.map((l) => (l.total === null ? 0 : emUnidade(l.total, unidade, areaM2))))
  const escala = (LARGURA - ROTULO - 70) / maximo
  const alturaGrupo = BARRA * 2 + 8 + 18
  const altura = sistemas.length * alturaGrupo

  return (
    <div className="grafico" onMouseLeave={() => setDica(null)}>
      <svg viewBox={`0 0 ${LARGURA} ${altura}`} width="100%" role="img" aria-label="A4 e A5 por sistema construtivo">
        <defs>
          <Hachura id="hachura-terra" cor={CATEGORIA_POR_ID.residuos.cor} />
        </defs>
        {sistemas.map((s, i) => {
          const y0 = i * alturaGrupo
          const apagado = destaque !== null && destaque !== s.id
          return (
            <g key={s.id} opacity={apagado ? 0.35 : 1}>
              <text x={0} y={y0 + 11} className={destaque === s.id ? 'rotulo-grafico forte' : 'rotulo-grafico'}>
                {s.nome}
              </text>
              {linhas
                .filter((l) => l.sistema.id === s.id)
                .map((l, j) => {
                  const y = y0 + 18 + j * (BARRA + 8)
                  let x = ROTULO
                  return (
                    <g key={l.modulo}>
                      <text x={ROTULO - 8} y={y + BARRA - 3} textAnchor="end" className="rotulo-eixo">
                        {l.modulo}
                      </text>
                      {l.segmentos.map((seg) => {
                        const largura = Math.max(1, emUnidade(seg.kg, unidade, areaM2) * escala - VAO)
                        const inicio = x
                        x += largura + VAO
                        const texto = `${s.nome} · ${l.modulo} · ${seg.rotulo}: ${formatarCarbono(emUnidade(seg.kg, unidade, areaM2), unidade)}`
                        return (
                          <rect
                            key={seg.rotulo}
                            x={inicio}
                            y={y}
                            width={largura}
                            height={BARRA}
                            rx={2}
                            fill={seg.hachura ? 'url(#hachura-terra)' : seg.cor}
                            stroke={seg.hachura ? seg.cor : 'none'}
                            onMouseMove={(e) => setDica({ x: e.nativeEvent.offsetX + 12, y: e.nativeEvent.offsetY - 28, texto })}
                          >
                            <title>{texto}</title>
                          </rect>
                        )
                      })}
                      <text x={x + 4} y={y + BARRA - 3} className="valor-grafico">
                        {l.total === null
                          ? 'pendente'
                          : `${formatarCarbono(emUnidade(l.total, unidade, areaM2), unidade).split(' ')[0]}${l.parcial ? '*' : ''}`}
                      </text>
                    </g>
                  )
                })}
            </g>
          )
        })}
      </svg>
      <Dica dica={dica} />
    </div>
  )
}

export function GraficoEscala({ sistemas, resultados, unidade, areaM2, destaque }: Props) {
  const [dica, setDica] = useState<DicaEstado>(null)
  const valores = sistemas.map((_, i) => ({
    calculado: totalA4A5(resultados[i]),
    referencia: resultados[i].referenciaA1A3KgCO2e,
  }))
  const maximo = Math.max(
    1e-9,
    ...valores.flatMap((v) => [v.calculado ?? 0, v.referencia ?? 0].map((kg) => emUnidade(kg, unidade, areaM2))),
  )
  const escala = (LARGURA - ROTULO - 8) / maximo
  const passo = BARRA * 2 + 22
  const altura = sistemas.length * passo

  return (
    <div className="grafico" onMouseLeave={() => setDica(null)}>
      <svg viewBox={`0 0 ${LARGURA} ${altura}`} width="100%" role="img" aria-label="A4 + A5 frente à referência de A1–A3">
        <defs>
          <Hachura id="hachura-referencia" cor="#9a9a9a" />
        </defs>
        {sistemas.map((s, i) => {
          const y = i * passo
          const { calculado, referencia } = valores[i]
          const apagado = destaque !== null && destaque !== s.id
          const textoRef =
            referencia === null
              ? `${s.nome}: sem referência brasileira de A1–A3`
              : `${s.nome} · A1–A3 (referência, não calculado): ${formatarCarbono(emUnidade(referencia, unidade, areaM2), unidade)}`
          const textoCalc =
            calculado === null
              ? `${s.nome}: A4 + A5 pendente`
              : `${s.nome} · A4 + A5: ${formatarCarbono(emUnidade(calculado, unidade, areaM2), unidade)}`
          return (
            <g key={s.id} opacity={apagado ? 0.35 : 1}>
              <text x={0} y={y + BARRA - 3} className={destaque === s.id ? 'rotulo-grafico forte' : 'rotulo-grafico'}>
                {s.nome}
              </text>
              {referencia === null ? (
                <text x={ROTULO} y={y + BARRA - 3} className="valor-grafico">
                  A1–A3: sem referência brasileira
                </text>
              ) : (
                <rect
                  x={ROTULO}
                  y={y}
                  width={Math.max(1, emUnidade(referencia, unidade, areaM2) * escala)}
                  height={BARRA}
                  rx={2}
                  fill="url(#hachura-referencia)"
                  stroke="#9a9a9a"
                  onMouseMove={(e) => setDica({ x: e.nativeEvent.offsetX + 12, y: e.nativeEvent.offsetY - 28, texto: textoRef })}
                >
                  <title>{textoRef}</title>
                </rect>
              )}
              {calculado === null ? (
                <text x={ROTULO} y={y + BARRA * 2 + 9} className="valor-grafico">
                  A4 + A5: pendente
                </text>
              ) : (
                <rect
                  x={ROTULO}
                  y={y + BARRA + 4}
                  width={Math.max(1, emUnidade(calculado, unidade, areaM2) * escala)}
                  height={BARRA}
                  rx={2}
                  fill="var(--texto)"
                  onMouseMove={(e) => setDica({ x: e.nativeEvent.offsetX + 12, y: e.nativeEvent.offsetY - 28, texto: textoCalc })}
                >
                  <title>{textoCalc}</title>
                </rect>
              )}
            </g>
          )
        })}
      </svg>
      <Dica dica={dica} />
    </div>
  )
}
