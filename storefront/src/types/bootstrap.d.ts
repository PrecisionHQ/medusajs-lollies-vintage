declare module "bootstrap/dist/js/bootstrap.bundle.min.js" {
  export class Modal {
    constructor(element: Element | null, options?: Record<string, unknown>)
    show(): void
    hide(): void
    toggle(): void
  }
  export class Offcanvas {
    constructor(element: Element | null, options?: Record<string, unknown>)
    show(): void
    hide(): void
    toggle(): void
  }
}
