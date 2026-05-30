export type RebuildEventType = 'input' | 'change'

type EventTargetLike = {
  addEventListener: (type: 'input' | 'change', listener: () => void) => void
}

export function attachRebuildListeners(
  updateInputs: EventTargetLike[],
  queueRebuild: (eventType: RebuildEventType) => void,
): void {
  updateInputs.forEach((el) => el.addEventListener('input', () => queueRebuild('input')))
  updateInputs.forEach((el) => el.addEventListener('change', () => queueRebuild('change')))
}

export function attachDiceFaceToggleHandlers(
  textToggles: EventTargetLike[],
  logoToggles: EventTargetLike[],
  updateDiceFaceOptionVisibility: (face: number) => void,
  queueRebuild: (eventType: RebuildEventType) => void,
): void {
  textToggles.forEach((toggle, index) => {
    const face = index + 1
    toggle.addEventListener('change', () => {
      updateDiceFaceOptionVisibility(face)
      queueRebuild('change')
    })
  })

  logoToggles.forEach((toggle, index) => {
    const face = index + 1
    toggle.addEventListener('change', () => {
      updateDiceFaceOptionVisibility(face)
      queueRebuild('change')
    })
  })
}
