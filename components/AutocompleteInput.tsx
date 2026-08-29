'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

type Suggestion = {
  name: string
  lat: number
  lon: number
  source: 'local' | 'nominatim'
}

type Props = {
  label: string
  placeholder: string
  value: string
  onChange: (val: string) => void
  onSelect: (name: string, coords: [number, number]) => void
}

function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return debounced
}

export default function AutocompleteInput({ label, placeholder, value, onChange, onSelect }: Props) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [activeIdx, setActiveIdx] = useState(-1)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const debouncedValue = useDebounce(value, 280)

  // Fetch suggestions
  useEffect(() => {
    if (debouncedValue.length < 2) {
      setSuggestions([])
      setOpen(false)
      return
    }
    setLoading(true)
    fetch(`/api/suggest?q=${encodeURIComponent(debouncedValue)}`)
      .then(r => r.json())
      .then((data: Suggestion[]) => {
        setSuggestions(data)
        setOpen(data.length > 0)
        setActiveIdx(-1)
      })
      .catch(() => setSuggestions([]))
      .finally(() => setLoading(false))
  }, [debouncedValue])

  // Fermer si clic extérieur
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = useCallback((s: Suggestion) => {
    onSelect(s.name, [s.lat, s.lon])
    setOpen(false)
    setSuggestions([])
  }, [onSelect])

  function handleKeyDown(e: React.KeyboardEvent) {
    if (!open || !suggestions.length) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx(i => Math.min(i + 1, suggestions.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx(i => Math.max(i - 1, 0))
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault()
      handleSelect(suggestions[activeIdx])
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div ref={wrapperRef} className="relative">
      <label className="text-xs text-slate-400 mb-1 block">{label}</label>
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={e => onChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 pr-8 text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
        />
        {loading && (
          <span className="absolute right-2.5 top-2.5 w-3.5 h-3.5 border-2 border-slate-500 border-t-blue-400 rounded-full animate-spin" />
        )}
      </div>

      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 w-full mt-1 bg-slate-800 border border-slate-600 rounded-lg shadow-xl overflow-hidden">
          {suggestions.map((s, i) => (
            <li
              key={i}
              onMouseDown={() => handleSelect(s)}
              onMouseEnter={() => setActiveIdx(i)}
              className={`px-3 py-2.5 cursor-pointer text-xs transition-colors flex items-start gap-2 ${
                i === activeIdx ? 'bg-blue-700 text-white' : 'text-slate-200 hover:bg-slate-700'
              }`}
            >
              <span className="mt-0.5 shrink-0 text-slate-400">
                {s.source === 'local' ? '📍' : '🔍'}
              </span>
              <span className="leading-snug">{s.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
