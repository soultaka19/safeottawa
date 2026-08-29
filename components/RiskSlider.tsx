'use client'

import { riskLabel } from '@/lib/routing'

type Preset = { label: string; value: number; icon: string; desc: string }

const PRESETS: Preset[] = [
  { label: 'Prudent',  value: 15, icon: '🧓', desc: 'Enfants, personnes agees' },
  { label: 'Normal',   value: 40, icon: '🚶', desc: 'Pieton adulte' },
  { label: 'Actif',    value: 65, icon: '🚲', desc: 'Cycliste experimente' },
]

type Props = {
  value: number
  onChange: (v: number) => void
}

export default function RiskSlider({ value, onChange }: Props) {
  const rl = riskLabel(value)

  // Couleur de fond du track proportionnelle au seuil
  const trackGradient = `linear-gradient(to right, #22c55e 0%, #84cc16 25%, #f97316 55%, #ef4444 80%, #dc2626 100%)`

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-300">Tolerance au risque</span>
        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-700"
          style={{ color: rl.color }}>
          {value} % — {rl.text}
        </span>
      </div>

      {/* Slider */}
      <div className="relative">
        {/* Track colore */}
        <div
          className="absolute top-1/2 -translate-y-1/2 w-full h-1.5 rounded-full pointer-events-none"
          style={{ background: trackGradient }}
        />
        {/* Indicateur du seuil choisi */}
        <div
          className="absolute top-1/2 -translate-y-1/2 h-1.5 bg-slate-900 rounded-r-full pointer-events-none"
          style={{ left: `${value}%`, right: 0 }}
        />
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="relative w-full h-4 appearance-none bg-transparent cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none
            [&::-webkit-slider-thumb]:w-4
            [&::-webkit-slider-thumb]:h-4
            [&::-webkit-slider-thumb]:rounded-full
            [&::-webkit-slider-thumb]:bg-white
            [&::-webkit-slider-thumb]:border-2
            [&::-webkit-slider-thumb]:border-slate-400
            [&::-webkit-slider-thumb]:shadow-md
            [&::-webkit-slider-thumb]:transition-colors
            [&::-webkit-slider-thumb]:hover:border-blue-400"
        />
      </div>

      {/* Labels axe */}
      <div className="flex justify-between text-xs text-slate-500 -mt-1">
        <span>0 %</span>
        <span>50 %</span>
        <span>100 %</span>
      </div>

      {/* Presets */}
      <div className="flex gap-1.5">
        {PRESETS.map(p => (
          <button
            key={p.label}
            onClick={() => onChange(p.value)}
            title={p.desc}
            className={`flex-1 py-1.5 rounded-lg text-xs font-medium border transition-colors
              ${value === p.value
                ? 'bg-blue-600 border-blue-500 text-white'
                : 'bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700'
              }`}
          >
            {p.icon} {p.label}
          </button>
        ))}
      </div>

      {/* Message contextuel */}
      <p className="text-xs text-slate-500 leading-snug">
        {value <= 15 && 'Routes avec tres peu de zones accidentogenes uniquement.'}
        {value > 15 && value <= 40 && 'Routes moderement securisees, evite les zones denses.'}
        {value > 40 && value <= 65 && 'La plupart des routes sont proposees, zones extremes exclues.'}
        {value > 65 && 'Toutes les routes sont proposees, y compris les plus exposees.'}
      </p>
    </div>
  )
}
