export interface CursorPosition {
  x: number
  y: number
}

export type MouseButton = 'left' | 'right' | 'middle'

export function getCursorPosition(): Promise<CursorPosition>
export function moveMouse(x: number, y: number): Promise<void>
export function mouseDown(button: MouseButton): Promise<void>
export function mouseUp(button: MouseButton): Promise<void>
export function click(button: MouseButton, count: 1 | 2 | 3): Promise<void>
export function scroll(dx: number, dy: number): Promise<void>
export function keySequence(sequence: string): Promise<void>
export function keyDown(key: string): Promise<void>
export function keyUp(key: string): Promise<void>
export function typeText(text: string): Promise<void>
