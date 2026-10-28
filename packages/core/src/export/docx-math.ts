import {
  Math as DocxMath,
  MathRun,
  MathFraction,
  MathSuperScript,
  MathSubScript,
  MathSubSuperScript,
  MathRadical,
  MathSum,
  MathIntegral,
  MathRoundBrackets,
  MathSquareBrackets,
  MathCurlyBrackets,
  MathAngledBrackets,
  type MathComponent,
} from 'docx'

const SYMBOLS: Record<string, string> = {
  alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', varepsilon: 'ε',
  zeta: 'ζ', eta: 'η', theta: 'θ', vartheta: 'ϑ', iota: 'ι', kappa: 'κ',
  lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', omicron: 'ο', pi: 'π', rho: 'ρ',
  sigma: 'σ', tau: 'τ', upsilon: 'υ', phi: 'φ', varphi: 'φ', chi: 'χ', psi: 'ψ',
  omega: 'ω',
  Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π', Sigma: 'Σ',
  Upsilon: 'Υ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
  cdot: '·', times: '×', pm: '±', mp: '∓', div: '÷', leq: '≤', le: '≤',
  geq: '≥', ge: '≥', neq: '≠', ne: '≠', approx: '≈', equiv: '≡', infty: '∞',
  to: '→', rightarrow: '→', leftarrow: '←', Rightarrow: '⇒', Leftarrow: '⇐',
  partial: '∂', nabla: '∇', in: '∈', notin: '∉', subset: '⊂', cup: '∪', cap: '∩',
  forall: '∀', exists: '∃', ldots: '…', cdots: '⋯', circ: '∘', prime: '′',
}

const SPACING = new Set([',', ';', ':', '!', ' ', 'quad', 'qquad'])

class Unsupported extends Error {}

class Parser {
  private i = 0
  constructor(private readonly s: string) {}

  parseAll(): MathComponent[] {
    const out = this.seq(false)
    if (this.i < this.s.length) throw new Unsupported('trailing')
    return out
  }

  private ws(): void {
    while (this.i < this.s.length && /\s/.test(this.s[this.i]!)) this.i++
  }

  private peekCmd(): string | null {
    if (this.s[this.i] !== '\\') return null
    const m = /^\\([A-Za-z]+|.)/.exec(this.s.slice(this.i))
    return m ? m[1]! : null
  }

  /** Parse a sequence until `}` (when inGroup), `\right`, or end. */
  private seq(inGroup: boolean, stopAtRight = false): MathComponent[] {
    const out: MathComponent[] = []
    for (;;) {
      this.ws()
      if (this.i >= this.s.length) {
        if (inGroup || stopAtRight) throw new Unsupported('unterminated')
        return out
      }
      const c = this.s[this.i]!
      if (c === '}') {
        if (inGroup) return out
        throw new Unsupported('stray }')
      }
      if (stopAtRight && this.peekCmd() === 'right') return out
      if (c === '^' || c === '_') {
        this.i++
        const arg = this.arg()
        const base = out.pop() ?? new MathRun('')
        out.push(this.attach(base, c, arg))
        continue
      }
      out.push(...this.atom())
    }
  }

  // Combine a pending `_` then `^` (or vice versa) into SubSuperScript.
  private pending = new WeakMap<object, { sub?: MathComponent[]; sup?: MathComponent[]; base: MathComponent }>()

  private attach(base: MathComponent, kind: string, arg: MathComponent[]): MathComponent {
    const p = this.pending.get(base)
    let result: MathComponent
    if (p) {
      if (kind === '^' && p.sub && !p.sup) {
        result = new MathSubSuperScript({ children: [p.base], subScript: p.sub, superScript: arg })
      } else if (kind === '_' && p.sup && !p.sub) {
        result = new MathSubSuperScript({ children: [p.base], subScript: arg, superScript: p.sup })
      } else throw new Unsupported('double script')
      return result
    }
    if (kind === '^') {
      result = new MathSuperScript({ children: [base], superScript: arg })
      this.pending.set(result, { sup: arg, base })
    } else {
      result = new MathSubScript({ children: [base], subScript: arg })
      this.pending.set(result, { sub: arg, base })
    }
    return result
  }

  /** One argument: a `{group}` or a single atom. */
  private arg(): MathComponent[] {
    this.ws()
    if (this.i >= this.s.length) throw new Unsupported('missing arg')
    if (this.s[this.i] === '{') {
      this.i++
      const g = this.seq(true)
      this.i++ // consume }
      return g
    }
    if (this.s[this.i] === '}' || this.s[this.i] === '^' || this.s[this.i] === '_') {
      throw new Unsupported('bad arg')
    }
    return this.atom()
  }

  private rawGroup(): string {
    this.ws()
    if (this.s[this.i] !== '{') throw new Unsupported('expected {')
    let depth = 0
    const start = this.i + 1
    for (; this.i < this.s.length; this.i++) {
      const c = this.s[this.i]
      if (c === '\\') { this.i++; continue }
      if (c === '{') depth++
      else if (c === '}' && --depth === 0) {
        const t = this.s.slice(start, this.i)
        this.i++
        if (/[\\{}]/.test(t)) throw new Unsupported('complex text')
        return t
      }
    }
    throw new Unsupported('unterminated text')
  }

  private atom(): MathComponent[] {
    const c = this.s[this.i]!
    if (c === '{') {
      this.i++
      const g = this.seq(true)
      this.i++
      return g
    }
    if (c === '\\') return this.command()
    if (/\d/.test(c)) {
      const m = /^\d+(?:\.\d+)?/.exec(this.s.slice(this.i))!
      this.i += m[0].length
      return [new MathRun(m[0])]
    }
    if (c === '&' || c === '$' || c === '#' || c === '%' || c === '~') throw new Unsupported(c)
    this.i++
    return [new MathRun(c)]
  }

  private delim(): 'round' | 'square' | 'curly' | 'angle' {
    this.ws()
    const c = this.s[this.i]
    if (c === '(' || c === ')') { this.i++; return 'round' }
    if (c === '[' || c === ']') { this.i++; return 'square' }
    if (c === '\\') {
      const cmd = this.peekCmd()
      if (cmd === '{' || cmd === '}') { this.i += 2; return 'curly' }
      if (cmd === 'langle' || cmd === 'rangle') { this.i += 1 + cmd.length; return 'angle' }
    }
    throw new Unsupported('delimiter')
  }

  private command(): MathComponent[] {
    const cmd = this.peekCmd()!
    this.i += 1 + cmd.length
    if (SPACING.has(cmd)) return [new MathRun(' ')]
    const sym = SYMBOLS[cmd]
    if (sym !== undefined) return [new MathRun(sym)]
    switch (cmd) {
      case 'frac':
      case 'dfrac':
      case 'tfrac': {
        const numerator = this.arg()
        const denominator = this.arg()
        return [new MathFraction({ numerator, denominator })]
      }
      case 'sqrt': {
        this.ws()
        let degree: MathComponent[] | undefined
        if (this.s[this.i] === '[') {
          const end = this.s.indexOf(']', this.i)
          if (end < 0) throw new Unsupported('sqrt degree')
          const inner = new Parser(this.s.slice(this.i + 1, end)).parseAll()
          degree = inner
          this.i = end + 1
        }
        const children = this.arg()
        return [new MathRadical(degree ? { children, degree } : { children })]
      }
      case 'sum':
      case 'int': {
        let sub: MathComponent[] | undefined
        let sup: MathComponent[] | undefined
        for (let k = 0; k < 2; k++) {
          this.ws()
          const ch = this.s[this.i]
          if (ch === '_' && !sub) { this.i++; sub = this.arg() }
          else if (ch === '^' && !sup) { this.i++; sup = this.arg() }
        }
        const opts = {
          children: [new MathRun('')] as MathComponent[],
          ...(sub ? { subScript: sub } : {}),
          ...(sup ? { superScript: sup } : {}),
        }
        return [cmd === 'sum' ? new MathSum(opts) : new MathIntegral(opts)]
      }
      case 'text':
      case 'mathrm':
      case 'textrm':
      case 'operatorname':
        return [new MathRun(this.rawGroup())]
      case 'left': {
        const kind = this.delim()
        const children = this.seq(false, true)
        if (this.peekCmd() !== 'right') throw new Unsupported('no \\right')
        this.i += 6
        this.delim()
        switch (kind) {
          case 'round': return [new MathRoundBrackets({ children })]
          case 'square': return [new MathSquareBrackets({ children })]
          case 'curly': return [new MathCurlyBrackets({ children })]
          default: return [new MathAngledBrackets({ children })]
        }
      }
      case '{': return [new MathRun('{')]
      case '}': return [new MathRun('}')]
      case '|': case '%': case '&': case '_': case '#': case '$':
        return [new MathRun(cmd === '|' ? '‖' : cmd)]
      default:
        throw new Unsupported(cmd)
    }
  }
}

/** Convert TeX to a docx Math (OMML). Returns null when anything is unsupported. */
export function texToDocxMath(tex: string): DocxMath | null {
  try {
    const children = new Parser(tex).parseAll()
    if (children.length === 0) return null
    return new DocxMath({ children })
  } catch (e) {
    if (e instanceof Unsupported) return null
    return null
  }
}
