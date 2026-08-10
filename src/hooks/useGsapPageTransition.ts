import { useRef } from 'react'
import { useGSAP } from '@gsap/react'
import gsap from 'gsap'

/** Staggers the direct children of the returned ref in on mount — used for
 * the dashboard's stat tiles and chart cards. Respects reduced-motion. */
export function useGsapStagger<T extends HTMLElement>(deps: unknown[] = []) {
  const ref = useRef<T>(null)

  useGSAP(
    () => {
      if (!ref.current) return
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
      const items = ref.current.children
      if (items.length === 0) return
      gsap.from(items, { opacity: 0, y: 12, duration: 0.4, stagger: 0.04, ease: 'power2.out' })
    },
    { scope: ref, dependencies: deps },
  )

  return ref
}
