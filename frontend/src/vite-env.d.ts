/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/react" />

/** Browsers still support `<marquee />`; @types/react omits it from JSX.IntrinsicElements. */
declare global {
  namespace JSX {
    interface IntrinsicElements {
      marquee: React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement> & {
          behavior?: string;
          direction?: string;
          scrollAmount?: number;
        },
        HTMLElement
      >;
    }
  }
}

export {};
