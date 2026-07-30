// @vitest-environment node

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PDFDocument } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { TONI_DESIGN_BOOKLET_DRAFT } from './defaults';
import { getDesignBookletContentCatalog } from './marketingContent';
import {
  DESIGN_BOOKLET_PDF_PAGE_SIZE,
  designBookletPdfFilename,
  generateDesignBookletPdf,
} from './pdf';
import { loadToniDesignBookletImages } from './request';

describe('design booklet PDF', () => {
  it(
    'renders the Toni booklet as six A4 pages',
    async () => {
      const bytes = await generateDesignBookletPdf({
        draft: TONI_DESIGN_BOOKLET_DRAFT,
        content: getDesignBookletContentCatalog(),
        images: await loadToniDesignBookletImages(),
      });
      const document = await PDFDocument.load(bytes);

      expect(new TextDecoder().decode(bytes.slice(0, 5))).toBe('%PDF-');
      expect(document.getPageCount()).toBe(6);
      expect(document.getTitle()).toContain('Toni');
      for (const page of document.getPages()) {
        expect(page.getWidth()).toBeCloseTo(
          DESIGN_BOOKLET_PDF_PAGE_SIZE.width,
          1,
        );
        expect(page.getHeight()).toBeCloseTo(
          DESIGN_BOOKLET_PDF_PAGE_SIZE.height,
          1,
        );
      }

      const outputDirectory = process.env.DESIGN_BOOKLET_OUTPUT_DIR?.trim();
      if (outputDirectory) {
        const absoluteDirectory = path.resolve(outputDirectory);
        await mkdir(absoluteDirectory, { recursive: true });
        await writeFile(
          path.join(
            absoluteDirectory,
            designBookletPdfFilename(TONI_DESIGN_BOOKLET_DRAFT.customerName),
          ),
          bytes,
        );
      }
    },
    30_000,
  );

  it('uses a filesystem-safe customer filename', () => {
    expect(designBookletPdfFilename(' Toni & Family ')).toBe(
      'toni-family-design-booklet.pdf',
    );
  });
});
