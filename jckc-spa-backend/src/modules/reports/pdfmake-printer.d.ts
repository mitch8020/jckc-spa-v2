/**
 * Hand-written typings for the server-side classes pdfmake 0.3 ships at
 * `pdfmake/js/*`. The package's main entry now exposes a browser-style
 * singleton (which @types/pdfmake covers), but the legacy-parity
 * `new PdfPrinter(fonts)` API is untyped. Only the surface used by
 * ReportsService is declared here.
 */
declare module 'pdfmake/js/URLResolver' {
  /**
   * Resolves http(s) resources referenced by a document definition; a
   * no-op for plain local file paths (our font files). Required third
   * constructor argument of PdfPrinter in pdfmake 0.3.
   */
  export default class URLResolver {
    constructor(virtualfs?: unknown);
    resolve(url: string, headers?: Record<string, string>): Promise<void>;
    resolved(): Promise<unknown[]>;
  }
}

declare module 'pdfmake/js/Printer' {
  import type {
    TDocumentDefinitions,
    TFontDictionary,
  } from 'pdfmake/interfaces';
  import type URLResolver from 'pdfmake/js/URLResolver';

  export default class PdfPrinter {
    constructor(
      fontDescriptors: TFontDictionary,
      virtualfs?: unknown,
      urlResolver?: URLResolver,
      localAccessPolicy?: (path: string) => boolean,
    );

    /**
     * Lays out the document and returns a pdfkit document (a readable
     * stream) ready to be ended and collected. Async in pdfmake 0.3
     * (remote resource resolution happens up front).
     */
    createPdfKitDocument(
      docDefinition: TDocumentDefinitions,
      options?: { bufferPages?: boolean; fontLayoutCache?: boolean },
    ): Promise<PDFKit.PDFDocument>;
  }
}
