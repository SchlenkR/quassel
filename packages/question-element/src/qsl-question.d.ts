/** Was eine Antwort transportiert: gewaehlte Optionen, Freitext und der fertige Antworttext. */
export interface QslQuestionAnswer {
  options: string[];
  text: string;
  value: string;
}

export type QslQuestionAnswerEvent = CustomEvent<QslQuestionAnswer>;

export declare class QslQuestionElement extends HTMLElement {
  text: string;
  options: string[];
  multi: boolean;
  placeholder: string;
  /** Gesetzt heisst: beantwortet, die Karte ist nur noch Beleg. */
  answer: string | null;
  disabled: boolean;
  busy: boolean;
  dismissible: boolean;
  readonly selectedOptions: string[];
  readonly freeText: string;
  addEventListener<K extends keyof HTMLElementEventMap>(
    type: K,
    listener: (this: QslQuestionElement, event: HTMLElementEventMap[K]) => unknown,
    options?: boolean | AddEventListenerOptions,
  ): void;
  addEventListener(
    type: "answer",
    listener: (this: QslQuestionElement, event: QslQuestionAnswerEvent) => unknown,
    options?: boolean | AddEventListenerOptions,
  ): void;
  addEventListener(
    type: "dismiss",
    listener: (this: QslQuestionElement, event: CustomEvent) => unknown,
    options?: boolean | AddEventListenerOptions,
  ): void;
  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject,
    options?: boolean | AddEventListenerOptions,
  ): void;
}

/** Registriert das Element; der Modul-Import macht das schon fuer "qsl-question". */
export declare function defineQslQuestion(tagName?: string): void;

declare global {
  interface HTMLElementTagNameMap {
    "qsl-question": QslQuestionElement;
  }
}
