/**
 * <qsl-question> - die Rueckfrage-Karte als Web Component, ohne Framework und ohne Bauschritt.
 * Light DOM statt Shadow DOM: unter style-src 'self' waere ein <style> im Shadow-Root blockiert,
 * und so teilen sich React-Karte und Element genau ein Stylesheet (question.css).
 */

const CHECK_PATH = "M20 6 9 17l-5-5";

const DEFAULT_TEXTS = {
  placeholder: "... oder frei antworten",
  submit: "Auswahl übernehmen",
  answer: "Antworten",
  dismiss: "Verwerfen",
};

function checkIcon(size, className) {
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");

  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("fill", "none");
  svg.setAttribute("stroke", "currentColor");
  svg.setAttribute("stroke-linecap", "round");
  svg.setAttribute("stroke-linejoin", "round");
  svg.setAttribute("stroke-width", "2");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));
  if (className) {
    svg.setAttribute("class", className);
  }
  path.setAttribute("d", CHECK_PATH);
  svg.appendChild(path);

  return svg;
}

function button(className, label, onClick) {
  const element = document.createElement("button");

  element.type = "button";
  element.className = className;
  if (label !== undefined) {
    element.append(label);
  }
  element.addEventListener("click", onClick);

  return element;
}

/** Optionen kommen als Array (Property) oder als JSON-Array bzw. Zeilenliste (Attribut). */
function readOptions(value) {
  if (Array.isArray(value)) {
    return value.map((option) => String(option));
  }
  if (typeof value !== "string" || value.trim() === "") {
    return [];
  }

  const trimmed = value.trim();

  if (trimmed.startsWith("[")) {
    const parsed = JSON.parse(trimmed);

    if (!Array.isArray(parsed)) {
      throw new TypeError("qsl-question: options muss ein Array sein");
    }
    return parsed.map((option) => String(option));
  }

  return trimmed.split("\n").map((option) => option.trim()).filter((option) => option !== "");
}

export class QslQuestionElement extends HTMLElement {
  static observedAttributes = [
    "text",
    "options",
    "multi",
    "placeholder",
    "answer",
    "disabled",
    "busy",
    "dismissible",
    "submit-label",
    "answer-label",
    "dismiss-label",
  ];

  #options = [];
  #selected = [];
  #draft = "";
  #ready = false;

  get text() {
    return this.getAttribute("text") ?? "";
  }

  set text(value) {
    this.setAttribute("text", value);
  }

  get options() {
    return [...this.#options];
  }

  /** Gleiche Optionen erneut zu setzen bleibt folgenlos - sonst raeumte jeder Render die Auswahl ab. */
  set options(value) {
    const next = readOptions(value);

    if (next.length === this.#options.length && next.every((option, index) => option === this.#options[index])) {
      return;
    }
    this.#options = next;
    this.#selected = [];
    this.#render();
  }

  get multi() {
    return this.hasAttribute("multi");
  }

  set multi(value) {
    this.toggleAttribute("multi", Boolean(value));
  }

  get placeholder() {
    return this.getAttribute("placeholder") ?? DEFAULT_TEXTS.placeholder;
  }

  set placeholder(value) {
    this.setAttribute("placeholder", value);
  }

  /** Gesetzt heisst: beantwortet, die Karte ist nur noch Beleg. */
  get answer() {
    return this.getAttribute("answer");
  }

  set answer(value) {
    if (value === null || value === undefined) {
      this.removeAttribute("answer");
    } else {
      this.setAttribute("answer", value);
    }
  }

  get disabled() {
    return this.hasAttribute("disabled");
  }

  set disabled(value) {
    this.toggleAttribute("disabled", Boolean(value));
  }

  /** Antwort unterwegs: sieht gedaempft aus und nimmt nichts mehr an. */
  get busy() {
    return this.hasAttribute("busy");
  }

  set busy(value) {
    this.toggleAttribute("busy", Boolean(value));
  }

  get dismissible() {
    return this.hasAttribute("dismissible");
  }

  set dismissible(value) {
    this.toggleAttribute("dismissible", Boolean(value));
  }

  get selectedOptions() {
    return [...this.#selected];
  }

  get freeText() {
    return this.#draft;
  }

  connectedCallback() {
    this.#ready = true;
    this.classList.add("qsl-question");
    if (!this.hasAttribute("role")) {
      this.setAttribute("role", "group");
    }
    this.#render();
  }

  attributeChangedCallback(name, previous, next) {
    if (previous === next) {
      return;
    }
    if (name === "options") {
      this.options = next;
      return;
    }
    this.#render();
  }

  #locked() {
    return this.disabled || this.busy;
  }

  #emitAnswer(options, text) {
    if (this.#locked()) {
      return;
    }

    const value = text === "" ? options.join("; ") : text;

    this.dispatchEvent(new CustomEvent("answer", {
      bubbles: true,
      composed: true,
      detail: { options, text, value },
    }));
  }

  #renderAnswered(answer) {
    const answered = document.createElement("div");

    answered.className = "qsl-question__answered";
    answered.append(checkIcon(12, "qsl-question__check"), answer);
    this.appendChild(answered);
  }

  #renderOptions() {
    const list = document.createElement("div");

    list.className = "qsl-question__options";

    for (const option of this.#options) {
      const chosen = this.#selected.includes(option);
      const entry = this.multi
        ? button("qsl-question__option", undefined, () => this.#toggle(option))
        : button("qsl-question__option", option, () => this.#emitAnswer([option], ""));

      if (this.multi) {
        const box = document.createElement("span");

        box.className = "qsl-question__kasten";
        if (chosen) {
          box.appendChild(checkIcon(10));
          entry.classList.add("qsl-question__option--gewaehlt");
        }
        entry.setAttribute("aria-pressed", String(chosen));
        entry.append(box, option);
      }

      entry.disabled = this.#locked();
      list.appendChild(entry);
    }

    this.appendChild(list);
  }

  #renderFreeRow() {
    const row = document.createElement("div");
    const field = document.createElement("input");
    const send = button(
      "qsl-question__frei-senden",
      this.getAttribute("answer-label") ?? DEFAULT_TEXTS.answer,
      () => this.#sendDraft());

    row.className = "qsl-question__frei";
    field.className = "qsl-field qsl-question__frei-feld";
    field.placeholder = this.placeholder;
    field.value = this.#draft;
    field.disabled = this.#locked();
    field.addEventListener("input", () => {
      this.#draft = field.value;
      send.disabled = this.#locked() || this.#draft.trim() === "";
    });
    field.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.isComposing) {
        this.#sendDraft();
      }
    });
    send.disabled = this.#locked() || this.#draft.trim() === "";
    row.append(field, send);

    if (this.dismissible) {
      const dismiss = button(
        "qsl-question__frei-senden qsl-question__dismiss",
        this.getAttribute("dismiss-label") ?? DEFAULT_TEXTS.dismiss,
        () => this.#dismiss());

      dismiss.disabled = this.#locked();
      row.appendChild(dismiss);
    }

    this.appendChild(row);
  }

  #render() {
    if (!this.#ready) {
      return;
    }

    const aktiv = document.activeElement;
    const auswahl = aktiv instanceof HTMLInputElement && this.contains(aktiv) && aktiv.classList.contains("qsl-question__frei-feld")
      ? [aktiv.selectionStart, aktiv.selectionEnd]
      : undefined;

    this.replaceChildren();
    this.classList.toggle("qsl-question--busy", this.busy);
    if (this.busy) {
      this.setAttribute("aria-busy", "true");
    } else {
      this.removeAttribute("aria-busy");
    }

    const text = document.createElement("div");

    text.className = "qsl-question__text";
    text.textContent = this.text;
    this.appendChild(text);

    const answer = this.answer;

    if (answer !== null) {
      this.#renderAnswered(answer);
      return;
    }

    this.#renderOptions();

    if (this.multi) {
      const submit = button(
        "qsl-question__uebernehmen",
        this.getAttribute("submit-label") ?? DEFAULT_TEXTS.submit,
        () => this.#emitAnswer(this.selectedOptions, ""));

      submit.disabled = this.#locked() || this.#selected.length === 0;
      this.appendChild(submit);
    }

    this.#renderFreeRow();

    const feld = this.querySelector(".qsl-question__frei-feld");

    if (auswahl && feld instanceof HTMLInputElement && !feld.disabled) {
      feld.focus();
      feld.setSelectionRange(auswahl[0], auswahl[1]);
    }
  }

  #toggle(option) {
    if (this.#locked()) {
      return;
    }

    const keyboard = this.contains(document.activeElement);

    this.#selected = this.#selected.includes(option)
      ? this.#selected.filter((chosen) => chosen !== option)
      : [...this.#selected, option];
    this.#render();

    // Der Neuaufbau ersetzt den geklickten Knopf - die Tastatur soll trotzdem stehen bleiben.
    const again = this.querySelectorAll(".qsl-question__option")[this.#options.indexOf(option)];

    if (keyboard && again instanceof HTMLElement) {
      again.focus();
    }
  }

  #sendDraft() {
    const value = this.#draft.trim();

    if (value !== "") {
      this.#emitAnswer([], value);
    }
  }

  #dismiss() {
    if (this.#locked()) {
      return;
    }

    this.dispatchEvent(new CustomEvent("dismiss", { bubbles: true, composed: true }));
  }
}

/** Selbstregistrierend: ein Import reicht, doppelte Imports stoeren nicht. */
export function defineQslQuestion(tagName = "qsl-question") {
  if (!customElements.get(tagName)) {
    customElements.define(tagName, QslQuestionElement);
  }
}

defineQslQuestion();
