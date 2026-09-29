import { Window } from "happy-dom";

export const window = new Window({ url: "http://localhost/" });

const globals = {
  window,
  document: window.document,
  navigator: window.navigator,
  Node: window.Node,
  Element: window.Element,
  HTMLElement: window.HTMLElement,
  HTMLIFrameElement: window.HTMLIFrameElement,
  Event: window.Event,
  ResizeObserver: window.ResizeObserver,
  getComputedStyle: window.getComputedStyle.bind(window),
  IS_REACT_ACT_ENVIRONMENT: true,
};

Object.entries(globals).forEach(([name, value]) => Object.defineProperty(globalThis, name, { value, configurable: true, writable: true }));
