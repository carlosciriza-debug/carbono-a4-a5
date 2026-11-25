import type { Edificio, IdSistema } from '../compartilhado/terreno'
import { SISTEMAS } from './sistemas'

export const AREA_MAXIMA_CONTROLE_M2 = 50_000

type Props = {
  edificio: Edificio
  aoMudar: (e: Edificio) => void
  destaque: IdSistema | null
  aoDestacar: (s: IdSistema | null) => void
}

function numero(texto: string): number {
  const n = Number(texto.replace(',', '.'))
  return Number.isFinite(n) && n >= 0 ? n : 0
}

export function PainelEdificio({ edificio, aoMudar, destaque, aoDestacar }: Props) {
  return (
    <div className="edificio">
      <h3 className="subtitulo">Edifício</h3>

      <label htmlFor="area-construida">Área construída (m²)</label>
      <div className="linha controle-area">
        <input
          type="range"
          min={0}
          max={AREA_MAXIMA_CONTROLE_M2}
          step={100}
          value={Math.min(edificio.areaConstruidaM2, AREA_MAXIMA_CONTROLE_M2)}
          onChange={(e) => aoMudar({ ...edificio, areaConstruidaM2: numero(e.target.value) })}
          aria-label="Área construída, controle deslizante"
        />
        <input
          id="area-construida"
          className="numero"
          type="number"
          min={0}
          step={10}
          value={edificio.areaConstruidaM2}
          onChange={(e) => aoMudar({ ...edificio, areaConstruidaM2: numero(e.target.value) })}
        />
      </div>

      <label htmlFor="volume-terra">Volume de movimento de terra (m³)</label>
      <input
        id="volume-terra"
        className="numero"
        type="number"
        min={0}
        step={10}
        value={edificio.volumeTerraM3}
        onChange={(e) => aoMudar({ ...edificio, volumeTerraM3: numero(e.target.value) })}
      />

      <fieldset className="destaque">
        <legend>Destacar sistema</legend>
        <label>
          <input type="radio" name="destaque" checked={destaque === null} onChange={() => aoDestacar(null)} /> nenhum
        </label>
        {SISTEMAS.map((s) => (
          <label key={s.id}>
            <input type="radio" name="destaque" checked={destaque === s.id} onChange={() => aoDestacar(s.id)} /> {s.nome}
          </label>
        ))}
      </fieldset>
    </div>
  )
}
