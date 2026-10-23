import { useId, type JSX } from 'react'

export function Logo(props: { size?: number; title?: string }): JSX.Element {
  const size = props.size ?? 32
  const titleId = useId()
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 128 128"
      width={size}
      height={size}
      role="img"
      aria-labelledby={titleId}
    >
      <title id={titleId}>{props.title ?? 'MD Reader'}</title>
      <rect width="128" height="128" rx="28" fill="#1B2422" />
      <path d="M32 20h50l16 16v72H32z" fill="#F1F3F2" />
      <path d="M82 20v16h16z" fill="#D3DAD7" />
      <rect x="44" y="20" width="5" height="88" fill="#23568C" />
      <rect x="56" y="48" width="34" height="14" rx="2" fill="#F3DE4A" />
      <rect x="59" y="53" width="26" height="4" rx="2" fill="#1B2422" />
      <rect x="59" y="72" width="30" height="4" rx="2" fill="#5E6A67" />
      <rect x="59" y="84" width="22" height="4" rx="2" fill="#5E6A67" />
    </svg>
  )
}
