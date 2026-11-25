import type { Position } from 'geojson'
import { useEffect, useMemo, useRef, useState } from 'react'
import { calcularSistema, fatoresNaoVerificados } from './carbono/calculo'
import { PainelEdificio } from './carbono/PainelEdificio'
import { PainelResultado } from './carbono/PainelResultado'
import { montarPremissas, pesoPorPonto, totalA4A5 } from './carbono/resultado'
import { SISTEMAS } from './carbono/sistemas'
import { INSTRUCAO_INICIAL, NOME_APP } from './compartilhado/app'
import { CATEGORIA_POR_ID } from './compartilhado/categorias'
import { type Fator, FATORES } from './compartilhado/fatores'
import type { Edificio, IdCategoria, IdSistema, Rota } from './compartilhado/terreno'
import {
  type BaseFornecedores,
  carregarBase,
  combinarPontos,
  ErroBase,
  pontosNoRaio,
  RAIO_INICIAL_KM,
} from './dados/fornecedores'
import { type EstadoAdicao, type EstadoBase, PainelFornecedores } from './dados/PainelFornecedores'
import {
  alternarDesligado,
  carregarPreferencias,
  ErroArquivo,
  exportarPreferencias,
  importarPreferencias,
  novoFornecedor,
  type Preferencias,
  salvarPreferencias,
} from './dados/preferencias'
import { useRotas } from './dados/useRotas'
import { type ControleMapa, Mapa, type RotaNoMapa } from './geometria/Mapa'
import { PainelTerreno } from './geometria/PainelTerreno'
import type { Lote } from './geometria/lote'

function baixarArquivo(nome: string, conteudo: string) {
  const url = URL.createObjectURL(new Blob([conteudo], { type: 'application/json' }))
  const link = document.createElement('a')
  link.href = url
  link.download = nome
  link.click()
  URL.revokeObjectURL(url)
}

function App() {
  const mapa = useRef<ControleMapa>(null)
  const [lote, setLote] = useState<Lote | null>(null)
  const [desenhando, setDesenhando] = useState(false)
  const [raioKm, setRaioKm] = useState(RAIO_INICIAL_KM)
  const [base, setBase] = useState<BaseFornecedores | null>(null)
  const [estadoBase, setEstadoBase] = useState<EstadoBase>({ tipo: 'carregando' })
  const [tentativa, setTentativa] = useState(0)

  const [preferencias, setPreferencias] = useState(() => carregarPreferencias())
  const [salvouNoNavegador, setSalvouNoNavegador] = useState(true)
  const [adicao, setAdicao] = useState<EstadoAdicao>(null)
  const [localNovo, setLocalNovo] = useState<Position | null>(null)
  const [edificio, setEdificio] = useState<Edificio>({ areaConstruidaM2: 1000, volumeTerraM3: 0 })
  const [destaque, setDestaque] = useState<IdSistema | null>(null)
  const [mensagemArquivo, setMensagemArquivo] = useState<{ tipo: 'ok' | 'erro'; texto: string } | null>(null)

  useEffect(() => {
    let cancelado = false
    carregarBase()
      .then((b) => {
        if (cancelado) return
        setBase(b)
        setEstadoBase({ tipo: 'pronta', extraidoEm: b.extraidoEm })
      })
      .catch((e) => {
        if (cancelado) return
        setEstadoBase({ tipo: 'erro', mensagem: e instanceof ErroBase ? e.message : 'Erro inesperado ao carregar a base.' })
      })
    return () => {
      cancelado = true
    }
  }, [tentativa])

  // Toda mudança é salva no navegador na hora, a partir de uma ação do usuário.
  function mudarPreferencias(mudar: (p: Preferencias) => Preferencias) {
    const novas = mudar(preferencias)
    setPreferencias(novas)
    setSalvouNoNavegador(salvarPreferencias(novas))
  }

  const pontos = useMemo(
    () =>
      base && lote
        ? combinarPontos(pontosNoRaio(base, lote.centro, raioKm), preferencias.proprios, preferencias.desligados, lote.centro)
        : [],
    [base, lote, raioKm, preferencias],
  )

  const { rotas, estado: estadoRotas, tentarDeNovo: tentarRotasDeNovo } = useRotas(lote?.centro ?? null, pontos)

  // F5: recalcula quando mudam lote, área, volume de terra, raio, pontos ativos ou fornecedores próprios
  // (tudo isso chega aqui pelas rotas e pelo edifício).
  const resultados = useMemo(
    () => (lote ? SISTEMAS.map((s) => calcularSistema(s, edificio, rotas, FATORES)) : []),
    [lote, edificio, rotas],
  )
  const premissas = useMemo(
    () => (lote ? montarPremissas(SISTEMAS, resultados, FATORES, rotas, edificio.volumeTerraM3) : []),
    [lote, resultados, rotas, edificio.volumeTerraM3],
  )
  const haNaoVerificados =
    fatoresNaoVerificados(FATORES as unknown as Record<string, Fator>, SISTEMAS).length > 0

  const rotasNoMapa = useMemo(() => {
    const pesos = resultados.map((r) => ({ pesos: pesoPorPonto(r), total: totalA4A5(r) }))
    return (Object.entries(rotas) as [IdCategoria, Rota][]).flatMap(([categoria, r]) => {
      const ponto = pontos.find((p) => p.id === r.pontoId)
      if (!r.geometria || !ponto) return []
      const peso = SISTEMAS.map((s, i) => {
        const { pesos: porPonto, total } = pesos[i]
        const kg = porPonto.get(r.pontoId)
        if (!kg || !total) return null
        return `${s.nome} ${((kg / total) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}%`
      })
        .filter(Boolean)
        .join(' · ')
      return [
        {
          categoria: CATEGORIA_POR_ID[categoria].nome,
          cor: CATEGORIA_POR_ID[categoria].cor,
          nomePonto: ponto.nome ?? 'Sem nome',
          distanciaKm: r.distanciaKm,
          estimada: r.estimada,
          peso: peso || 'não entra no cálculo',
          geometria: r.geometria,
        } satisfies RotaNoMapa,
      ]
    })
  }, [rotas, pontos, resultados])

  function editarProprio(id: string, nome: string, categoria: IdCategoria) {
    mudarPreferencias((p) => ({
      ...p,
      proprios: p.proprios.map((f) => (f.id === id ? { ...f, nome: nome.trim(), categoria } : f)),
    }))
  }

  function removerProprio(id: string) {
    mudarPreferencias((p) => ({
      desligados: p.desligados.filter((d) => d !== id),
      proprios: p.proprios.filter((f) => f.id !== id),
    }))
  }

  function salvarNovo(nome: string, categoria: IdCategoria) {
    if (!localNovo) return
    mudarPreferencias((p) => ({ ...p, proprios: [...p.proprios, novoFornecedor(nome, categoria, localNovo)] }))
    setAdicao(null)
    setLocalNovo(null)
  }

  function importar(texto: string) {
    try {
      const novas = importarPreferencias(texto, preferencias)
      const adicionados = novas.proprios.length - preferencias.proprios.length
      mudarPreferencias(() => novas)
      setMensagemArquivo({
        tipo: 'ok',
        texto: `Arquivo importado: ${novas.proprios.length} fornecedores próprios (${Math.max(adicionados, 0)} novos) e ${novas.desligados.length} pontos desligados.`,
      })
    } catch (e) {
      setMensagemArquivo({ tipo: 'erro', texto: e instanceof ErroArquivo ? e.message : 'Não foi possível ler o arquivo.' })
    }
  }

  return (
    <div className="aplicacao">
      <Mapa
        ref={mapa}
        pontos={pontos}
        rotas={rotasNoMapa}
        escolhendoLocal={adicao?.etapa === 'local'}
        aoEscolherLocal={(c) => {
          setLocalNovo(c)
          setAdicao({ etapa: 'dados' })
        }}
        aoAlternarPonto={(id) => mudarPreferencias((p) => alternarDesligado(p, id))}
        aoMudarLote={setLote}
        aoMudarDesenho={setDesenhando}
      />

      <aside className="painel">
        <header>
          <h1>{NOME_APP}</h1>
          {!lote && !desenhando && <p className="instrucao">{INSTRUCAO_INICIAL}</p>}
        </header>

        <PainelTerreno
          lote={lote}
          desenhando={desenhando}
          aoEscolherEndereco={(r) => mapa.current?.irPara(r)}
          aoDesenhar={() => {
            setAdicao(null)
            mapa.current?.desenharLote()
          }}
          aoApagar={() => mapa.current?.apagarLote()}
        >
          <PainelEdificio edificio={edificio} aoMudar={setEdificio} destaque={destaque} aoDestacar={setDestaque} />
        </PainelTerreno>

        <PainelFornecedores
          temLote={lote !== null}
          raioKm={raioKm}
          aoMudarRaio={setRaioKm}
          estado={estadoBase}
          aoTentarDeNovo={() => {
            setEstadoBase({ tipo: 'carregando' })
            setTentativa((t) => t + 1)
          }}
          pontos={pontos}
          rotas={rotas}
          estadoRotas={estadoRotas}
          aoTentarRotasDeNovo={tentarRotasDeNovo}
          aoAlternar={(id) => mudarPreferencias((p) => alternarDesligado(p, id))}
          aoEditar={editarProprio}
          aoRemover={removerProprio}
          adicao={adicao}
          aoIniciarAdicao={() => setAdicao({ etapa: 'local' })}
          aoCancelarAdicao={() => {
            setAdicao(null)
            setLocalNovo(null)
          }}
          aoSalvarNovo={salvarNovo}
          aoExportar={() => baixarArquivo('fornecedores-carbono-a4-a5.json', exportarPreferencias(preferencias))}
          aoImportar={importar}
          mensagemArquivo={mensagemArquivo}
          salvouNoNavegador={salvouNoNavegador}
        />

        <PainelResultado
          temLote={lote !== null}
          sistemas={SISTEMAS}
          resultados={resultados}
          edificio={edificio}
          destaque={destaque}
          pontos={pontos}
          premissas={premissas}
          haNaoVerificados={haNaoVerificados}
        />
      </aside>
    </div>
  )
}

export default App
