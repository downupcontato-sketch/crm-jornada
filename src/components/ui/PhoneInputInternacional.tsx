import { useState, useRef, useEffect, useCallback } from 'react'
import { ChevronDown, Search, X } from 'lucide-react'
import { isValidPhoneNumber, parsePhoneNumber, AsYouType } from 'libphonenumber-js'
import { cn } from '@/lib/utils'

// ─── Country data ────────────────────────────────────────────────────────────

export interface Country {
  code: string
  name: string
  dial: string
  placeholder: string
  minDigits: number
}

const PRIORITY_CODES = ['BR', 'PT', 'AO', 'MZ', 'CV', 'US']

export const COUNTRIES: Country[] = [
  { code: 'BR', name: 'Brasil',               dial: '+55',  placeholder: '(11) 99999-9999',    minDigits: 10 },
  { code: 'PT', name: 'Portugal',             dial: '+351', placeholder: '912 345 678',         minDigits: 9  },
  { code: 'AO', name: 'Angola',               dial: '+244', placeholder: '923 456 789',         minDigits: 9  },
  { code: 'MZ', name: 'Moçambique',           dial: '+258', placeholder: '84 123 4567',         minDigits: 8  },
  { code: 'CV', name: 'Cabo Verde',           dial: '+238', placeholder: '991 23 45',           minDigits: 7  },
  { code: 'US', name: 'Estados Unidos',       dial: '+1',   placeholder: '(555) 555-5555',      minDigits: 10 },
  { code: 'AR', name: 'Argentina',            dial: '+54',  placeholder: '11 2345-6789',        minDigits: 10 },
  { code: 'BO', name: 'Bolívia',              dial: '+591', placeholder: '7 123 4567',          minDigits: 8  },
  { code: 'CL', name: 'Chile',               dial: '+56',  placeholder: '9 8765 4321',         minDigits: 9  },
  { code: 'CO', name: 'Colômbia',            dial: '+57',  placeholder: '300 123 4567',        minDigits: 10 },
  { code: 'EC', name: 'Equador',             dial: '+593', placeholder: '98 765 4321',         minDigits: 9  },
  { code: 'PY', name: 'Paraguai',            dial: '+595', placeholder: '961 456789',          minDigits: 9  },
  { code: 'PE', name: 'Peru',               dial: '+51',  placeholder: '912 345 678',         minDigits: 9  },
  { code: 'UY', name: 'Uruguai',            dial: '+598', placeholder: '94 231 234',          minDigits: 8  },
  { code: 'VE', name: 'Venezuela',          dial: '+58',  placeholder: '412 1234567',         minDigits: 10 },
  { code: 'MX', name: 'México',             dial: '+52',  placeholder: '55 1234 5678',        minDigits: 10 },
  { code: 'CA', name: 'Canadá',             dial: '+1',   placeholder: '(416) 555-5555',      minDigits: 10 },
  { code: 'GB', name: 'Reino Unido',        dial: '+44',  placeholder: '7700 900000',         minDigits: 10 },
  { code: 'ES', name: 'Espanha',            dial: '+34',  placeholder: '612 345 678',         minDigits: 9  },
  { code: 'FR', name: 'França',             dial: '+33',  placeholder: '06 12 34 56 78',      minDigits: 9  },
  { code: 'DE', name: 'Alemanha',           dial: '+49',  placeholder: '1512 3456789',        minDigits: 10 },
  { code: 'IT', name: 'Itália',             dial: '+39',  placeholder: '312 345 6789',        minDigits: 9  },
  { code: 'CH', name: 'Suíça',              dial: '+41',  placeholder: '76 234 56 78',        minDigits: 9  },
  { code: 'BE', name: 'Bélgica',            dial: '+32',  placeholder: '470 12 34 56',        minDigits: 9  },
  { code: 'NL', name: 'Holanda',            dial: '+31',  placeholder: '6 12345678',          minDigits: 9  },
  { code: 'SE', name: 'Suécia',             dial: '+46',  placeholder: '70 123 45 67',        minDigits: 9  },
  { code: 'NO', name: 'Noruega',            dial: '+47',  placeholder: '412 34 567',          minDigits: 8  },
  { code: 'AU', name: 'Austrália',          dial: '+61',  placeholder: '412 345 678',         minDigits: 9  },
  { code: 'NZ', name: 'Nova Zelândia',      dial: '+64',  placeholder: '21 123 4567',         minDigits: 8  },
  { code: 'JP', name: 'Japão',              dial: '+81',  placeholder: '90 1234 5678',        minDigits: 10 },
  { code: 'CN', name: 'China',              dial: '+86',  placeholder: '131 2345 6789',       minDigits: 11 },
  { code: 'IN', name: 'Índia',              dial: '+91',  placeholder: '81234 56789',         minDigits: 10 },
  { code: 'ZA', name: 'África do Sul',      dial: '+27',  placeholder: '71 123 4567',         minDigits: 9  },
  { code: 'NG', name: 'Nigéria',            dial: '+234', placeholder: '802 123 4567',        minDigits: 10 },
  { code: 'KE', name: 'Quênia',             dial: '+254', placeholder: '712 345678',          minDigits: 9  },
  { code: 'GH', name: 'Gana',               dial: '+233', placeholder: '23 123 4567',         minDigits: 9  },
  { code: 'IL', name: 'Israel',             dial: '+972', placeholder: '50 234 5678',         minDigits: 9  },
]

const PRIORITY_COUNTRIES = COUNTRIES.filter(c => PRIORITY_CODES.includes(c.code))
const OTHER_COUNTRIES = COUNTRIES.filter(c => !PRIORITY_CODES.includes(c.code)).sort((a, b) => a.name.localeCompare(b.name, 'pt'))

// ─── Utils ───────────────────────────────────────────────────────────────────

function flagEmoji(code: string): string {
  return code
    .toUpperCase()
    .split('')
    .map(c => String.fromCodePoint(0x1F1E6 + c.charCodeAt(0) - 65))
    .join('')
}

export function toE164(dial: string, rawNumber: string): string {
  const digits = rawNumber.replace(/\D/g, '')
  if (!digits) return ''
  return `${dial}${digits}`
}

export function validatePhone(e164: string, countryCode: string): boolean {
  if (!e164 || e164.length < 7) return false
  try {
    return isValidPhoneNumber(e164, countryCode as never)
  } catch {
    return false
  }
}

export function formatE164Display(e164: string): string {
  if (!e164) return ''
  try {
    const parsed = parsePhoneNumber(e164)
    return parsed?.formatInternational() ?? e164
  } catch {
    return e164
  }
}

// ─── Props ───────────────────────────────────────────────────────────────────

interface PhoneInputInternacionalProps {
  value: string
  onChange: (value: string) => void
  defaultCountry?: string
  onCountryChange?: (code: string, name: string) => void
  error?: string
  className?: string
  style?: React.CSSProperties
  inputStyle?: React.CSSProperties
}

// ─── Componente ─────────────────────────────────────────────────────────────

export function PhoneInputInternacional({
  value,
  onChange,
  defaultCountry = 'BR',
  onCountryChange,
  error,
  className,
  style,
  inputStyle: inputStyleProp,
}: PhoneInputInternacionalProps) {
  const defaultC = COUNTRIES.find(c => c.code === defaultCountry) ?? COUNTRIES[0]
  const [country, setCountry] = useState<Country>(defaultC)
  const [rawNumber, setRawNumber] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [search, setSearch] = useState('')
  const dropdownRef = useRef<HTMLDivElement>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  // Sync rawNumber when value changes externally (e.g. form reset)
  useEffect(() => {
    if (!value) {
      setRawNumber('')
    }
  }, [value])

  // Close dropdown on outside click or Escape
  useEffect(() => {
    if (!dropdownOpen) return
    function handle(e: MouseEvent | KeyboardEvent) {
      if (e instanceof KeyboardEvent) {
        if (e.key === 'Escape') setDropdownOpen(false)
        return
      }
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    document.addEventListener('keydown', handle)
    return () => {
      document.removeEventListener('mousedown', handle)
      document.removeEventListener('keydown', handle)
    }
  }, [dropdownOpen])

  // Focus search input when dropdown opens
  useEffect(() => {
    if (dropdownOpen) setTimeout(() => searchRef.current?.focus(), 50)
    else setSearch('')
  }, [dropdownOpen])

  const filtered = search.trim()
    ? COUNTRIES.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.dial.includes(search) ||
        c.code.toLowerCase().includes(search.toLowerCase())
      )
    : null

  function selectCountry(c: Country) {
    setCountry(c)
    setRawNumber('')
    onChange('')
    onCountryChange?.(c.code, c.name)
    setDropdownOpen(false)
  }

  const handleNumberChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value
    // Use AsYouType for live formatting
    const formatter = new AsYouType(country.code as never)
    const formatted = formatter.input(raw.replace(/\D/g, ''))
    setRawNumber(formatted)
    const e164 = toE164(country.dial, formatted)
    onChange(e164)
  }, [country, onChange])

  return (
    <div className={cn('space-y-1.5', className)} style={style}>
      <div className="flex gap-2">
        {/* Country selector */}
        <div className="relative" ref={dropdownRef}>
          <button
            type="button"
            onClick={() => setDropdownOpen(v => !v)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-sm transition-all flex-shrink-0 h-full',
              error ? 'border-red-400/50' : 'border-border',
            )}
            style={inputStyleProp ? { ...inputStyleProp, width: 'auto', padding: '12px' } : undefined}
          >
            <span className="text-base leading-none">{flagEmoji(country.code)}</span>
            <span className="text-xs font-medium text-muted-foreground">{country.dial}</span>
            <ChevronDown size={12} className={cn('text-muted-foreground/60 transition-transform', dropdownOpen && 'rotate-180')} />
          </button>

          {/* Dropdown */}
          {dropdownOpen && (
            <div className="absolute left-0 top-full mt-1 z-50 w-64 rounded-xl border border-border bg-card shadow-xl overflow-hidden">
              {/* Search */}
              <div className="p-2 border-b border-border/50">
                <div className="relative">
                  <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/50" />
                  <input
                    ref={searchRef}
                    type="text"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Buscar país ou DDI..."
                    className="w-full pl-7 pr-7 py-1.5 text-xs bg-muted/20 border border-border rounded-lg text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-muted"
                  />
                  {search && (
                    <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-muted-foreground">
                      <X size={11} />
                    </button>
                  )}
                </div>
              </div>

              {/* List */}
              <div className="max-h-52 overflow-y-auto">
                {filtered ? (
                  filtered.length === 0 ? (
                    <p className="text-xs text-muted-foreground/50 text-center py-4">Nenhum país encontrado</p>
                  ) : (
                    filtered.map(c => <CountryOption key={c.code} c={c} selected={country.code === c.code} onSelect={selectCountry} />)
                  )
                ) : (
                  <>
                    <div className="px-3 pt-2 pb-1">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground/40">Sugeridos</p>
                    </div>
                    {PRIORITY_COUNTRIES.map(c => (
                      <CountryOption key={c.code} c={c} selected={country.code === c.code} onSelect={selectCountry} />
                    ))}
                    <div className="mx-3 my-1 border-t border-border/40" />
                    <div className="px-3 pt-1 pb-1">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground/40">Todos os países</p>
                    </div>
                    {OTHER_COUNTRIES.map(c => (
                      <CountryOption key={c.code} c={c} selected={country.code === c.code} onSelect={selectCountry} />
                    ))}
                  </>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Number input */}
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          value={rawNumber}
          onChange={handleNumberChange}
          placeholder={country.placeholder}
          className={cn(
            'flex-1 rounded-xl border bg-muted/10 px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 outline-none transition-all focus:border-muted',
            error ? 'border-red-400/50 focus:border-red-400/70' : 'border-border focus:border-muted',
          )}
          style={inputStyleProp}
        />
      </div>

      {/* Hint */}
      {!error && (
        <p className="text-[11px] text-muted-foreground/50">
          {country.name} · Formato: {country.placeholder}
        </p>
      )}
      {error && (
        <p className="text-[11px] text-red-400">{error}</p>
      )}
    </div>
  )
}

// ─── CountryOption ───────────────────────────────────────────────────────────

function CountryOption({ c, selected, onSelect }: { c: Country; selected: boolean; onSelect: (c: Country) => void }) {
  return (
    <button
      type="button"
      onClick={() => onSelect(c)}
      className={cn(
        'w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-muted/20 transition-colors',
        selected && 'bg-muted/10',
      )}
    >
      <span className="text-base leading-none flex-shrink-0">{flagEmoji(c.code)}</span>
      <span className="flex-1 text-xs text-foreground/80 truncate">{c.name}</span>
      <span className="text-[11px] text-muted-foreground/60 flex-shrink-0">{c.dial}</span>
    </button>
  )
}
