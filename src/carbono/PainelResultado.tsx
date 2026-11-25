import { useState } from 'react'
import { CATEGORIA_POR_ID } from '../compartilhado/categorias'
import type { Edificio, IdCategoria, IdSistema, Ponto, ResultadoSistema } from '../compartilhado/terreno'
import type { Sistema } from './calculo'
import { GraficoA4A5, GraficoEscala } from './Graficos'
import { emUnidade, formatarCarbono, type Premissa, totalA4A5, type Unidade } from './resultado'

type Props = {
  temLote: boolean
  sistemas: Sistema[]
  resultados: ResultadoSistema[]
  edificio: Edificio
  destaque: IdSistema | null
  pontos: Ponto[]
  premissas: Premissa[]
  haNaoVerificados: boolean
}

const ROTULO_PREMISSA: Record<Premissa['tipo'], string> = {
  fonte: 'Fonte',
  estimado: 'Estimado',
  pendente: 'Pendente',
  escopo: 'Escopo',
}

function formatarT(t: number | null) {
  return t === null ? '—' : `${t.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} t`
}

export function PainelResultado(props: Props) {
  const { temLote, sistemas, resultados, edificio, destaque, pontos, premissas } = props
  const [unidade, setUnidade] = useState<Unidade>('total')
  const area = edificio.areaConstruidaM2
  const nomePonto = (id: string | null) => (id ? (pontos.find((p) => p.id === id)?.nome ?? 'Sem nome') : '—')
  const iTabela = Math.max(0, sistemas.findIndex((s) => s.id === destaque))
  const sistemaTabela = sistemas[iTabela]
  const resultadoTabela = resultados[iTabela]

  return (
    <section className="secao">
      <h2>Resultado</h2>

      {props.haNaoVerificados && (
        <p className="aviso-fixo" role="alert">
          Resultado preliminar: há fatores ainda não verificados.
        </p>
      )}

      {!temLote ? (
        <p className="pendente">Desenhe o lote para calcular.</p>
      ) : (
        <>
          <div className="alternar-unidade" role="group" aria-label="Unidade">
            <button type="button" className={unidade === 'total' ? 'ativo' : ''} onClick={() => setUnidade('total')}>
              kgCO₂e
            </button>
            <button type="button" className={unidade === 'porM2' ? 'ativo' : ''} onClick={() => setUnidade('porM2')}>
              kgCO₂e/m²
            </button>
          </div>

          <h3 className="subtitulo">A4 e A5 por sistema</h3>
          <GraficoA4A5 sistemas={sistemas} resultados={resultados} unidade={unidade} areaM2={area} destaque={destaque} />
          <ul className="legenda">
            {(['concreto', 'aco', 'madeira'] as IdCategoria[]).map((c) => (
              <li key={c}>
                <span className="amostra" style={{ background: CATEGORIA_POR_ID[c].cor }} /> {CATEGORIA_POR_ID[c].nome} (A4)
              </li>
            ))}
            <li>
              <span className="amostra" style={{ background: CATEGORIA_POR_ID.residuos.cor }} /> Resíduos (A5)
            </li>
            <li>
              <span className="amostra hachurada" style={{ color: CATEGORIA_POR_ID.residuos.cor }} /> Movimento de terra (A5)
            </li>
          </ul>
          <p className="dica">* parcial: alguma parcela está pendente (ver premissas).</p>

          <h3 className="subtitulo">Escala: A4 + A5 frente a A1–A3</h3>
          <GraficoEscala sistemas={sistemas} resultados={resultados} unidade={unidade} areaM2={area} destaque={destaque} />
          <ul className="legenda">
            <li>
              <span className="amostra" style={{ background: 'var(--texto)' }} /> A4 + A5 (calculado)
            </li>
            <li>
              <span className="amostra hachurada" style={{ color: '#9a9a9a' }} /> A1–A3: referência, não calculado
            </li>
          </ul>
          <ul className="proporcoes">
            {sistemas.map((s, i) => {
              const calc = totalA4A5(resultados[i])
              const ref = resultados[i].referenciaA1A3KgCO2e
              return (
                <li key={s.id}>
                  {s.nome}:{' '}
                  {calc !== null && ref
                    ? `A4 + A5 = ${((calc / ref) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% da referência de A1–A3 (${sistemas[i].referenciaA1A3.citacao})`
                    : 'sem comparação (valor pendente)'}
                </li>
              )
            })}
          </ul>

          <h3 className="subtitulo">Detalhamento — {sistemaTabela.nome}</h3>
          {destaque === null && <p className="dica">Destaque um sistema em Edifício para ver outro.</p>}
          <div className="tabela-rolagem">
            <table className="detalhamento">
              <thead>
                <tr>
                  <th>Módulo</th>
                  <th>Material</th>
                  <th className="num">Massa</th>
                  <th>Origem / destino</th>
                  <th className="num">Distância</th>
                  <th className="num">Emissão</th>
                </tr>
              </thead>
              <tbody>
                {resultadoTabela.detalhamento.map((d, k) => (
                  <tr key={k}>
                    <td>{d.modulo}</td>
                    <td>
                      {d.material}
                      {d.substituicao && <span className="selo">geral</span>}
                    </td>
                    <td className="num">{formatarT(d.massaT)}</td>
                    <td>{nomePonto(d.pontoId)}</td>
                    <td className="num">
                      {d.distanciaKm === null
                        ? '—'
                        : `${d.estimada ? '≈ ' : ''}${d.distanciaKm.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} km`}
                    </td>
                    <td className={d.kgCO2e === null ? 'num pendente' : 'num'}>
                      {d.kgCO2e === null ? 'pendente' : formatarCarbono(emUnidade(d.kgCO2e, unidade, area), unidade)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <h3 className="subtitulo">Premissas</h3>
      <ul className="premissas">
        {premissas.map((p, k) => (
          <li key={k} className={`premissa ${p.tipo}`}>
            <span className="tipo-premissa">{ROTULO_PREMISSA[p.tipo]}</span> {p.texto}
          </li>
        ))}
      </ul>
      <p className="fonte">Fontes completas e notas em src/dados-fixos/ e no README.</p>
    </section>
  )
}
