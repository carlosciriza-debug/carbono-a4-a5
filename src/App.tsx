import type { Position } from 'geojson'
import { useEffect, useMemo, useRef, useState } from 'react'
import { INSTRUCAO_INICIAL, NOME_APP } from './compartilhado/app'
import type { IdCategoria } from './compartilhado/terreno'
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
import { type ControleMapa, Mapa } from './geometria/Mapa'
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
        />

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

        <section className="secao">
          <h2>Resultado</h2>
          <p className="pendente">Disponível em uma etapa futura.</p>
        </section>
      </aside>
    </div>
  )
}

export default App
