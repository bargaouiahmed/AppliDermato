import { CommonModule } from '@angular/common';
import { Component, DestroyRef, OnInit, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import {
  CnamMedicationLineResponse,
  CnamPrintDataResponse,
  ConduiteDocumentType,
  ConsultationConduiteResponse,
} from '../../../../core/models/conduite.models';
import { AuthenticatedAccountResponse } from '../../../../core/models/auth.models';
import { DoctorProfile } from '../../../../core/models/doctor.models';
import { Lang } from '../../../../core/models/i18n.models';
import { environment } from '../../../../../environments/environment';
import { AuthService } from '../../../../core/services/auth.service';
import { ConduiteService } from '../../../../core/services/conduite.service';
import { DoctorService } from '../../../../core/services/doctor.service';
import { I18nService } from '../../../../core/services/i18n.service';
import { catchError, forkJoin, map, Observable, of, switchMap } from 'rxjs';

type DoctorPrintInfo = {
  firstName: string;
  lastName: string;
  firstNameAr: string;
  lastNameAr: string;
  codeCnam: string;
  cabinetAddress: string;
  city: string;
  landline: string;
  phoneNumber: string;
  showHeader: boolean;
  showFooter: boolean;
  showFirstName: boolean;
  showLastName: boolean;
  showCodeCnam: boolean;
  showFirstNameArabic: boolean;
  showLastNameArabic: boolean;
  showFooterCabinetAddress: boolean;
  showFooterLandline: boolean;
  showFooterMobile: boolean;
};

type ParacliniquePrintSection = 'chirurgie' | 'laser' | 'imagerie' | 'bilan_sanguin';
type PdfLibNamespace = {
  PDFDocument: {
    load(source: ArrayBuffer | Uint8Array, options?: { ignoreEncryption?: boolean }): Promise<any>;
  };
  StandardFonts: {
    Helvetica: unknown;
  };
  degrees(value: number): unknown;
};
type PdfPageLike = {
  getRotation(): { angle: number };
  getWidth(): number;
  getHeight(): number;
  drawText(text: string, options: Record<string, unknown>): void;
};
type PdfFontLike = {
  widthOfTextAtSize(text: string, size: number): number;
};
type WindowWithPdfLib = Window & {
  PDFLib?: PdfLibNamespace;
};

@Component({
  selector: 'app-consultation-print-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './consultation-print-page.html',
  styleUrl: './consultation-print-page.css',
})
export class ConsultationPrintPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly conduiteService = inject(ConduiteService);
  private readonly authService = inject(AuthService);
  private readonly doctorService = inject(DoctorService);
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);

  protected isLoading = true;
  protected errorMessage = '';

  ngOnInit(): void {
    const consultationId = (this.route.snapshot.paramMap.get('consultationId') ?? '').trim();
    const documentType = this.normalizeDocumentType(this.route.snapshot.paramMap.get('documentType') ?? '');

    if (!consultationId || !documentType) {
      this.isLoading = false;
      this.errorMessage = this.i18n.t('consultation.documents.toast.printFailed');
      return;
    }

    const requestedLang = this.route.snapshot.queryParamMap.get('lang') ?? this.i18n.lang();
    const lang = this.normalizeLang(requestedLang);

    if (documentType === 'cnam') {
      this.printCnamFromFrontend(consultationId);
      return;
    }

    if (documentType === 'lettre_confrere') {
      this.printLettreConfrereFromFrontend(consultationId, lang);
      return;
    }

    const paracliniqueSections = documentType === 'paraclinique'
      ? this.parseParacliniqueSections(this.route.snapshot.queryParamMap.get('sections'))
      : undefined;

    this.conduiteService
      .printDocument(consultationId, documentType, lang, paracliniqueSections)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.renderPrintableHtml(response.htmlContent);
        },
        error: () => {
          this.isLoading = false;
          this.errorMessage = this.i18n.t('consultation.documents.toast.printFailed');
        },
      });
  }

  protected retry(): void {
    window.location.reload();
  }

  private renderPrintableHtml(htmlContent: string): void {
    const doc = window.document;
    doc.open();
    doc.write(htmlContent);
    doc.close();
  }

  private printCnamFromFrontend(consultationId: string): void {
    this.conduiteService
      .getCnamPrintData(consultationId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: async (response) => {
          try {
            const blob = await this.generateCnamPdf(response);
            this.renderPrintablePdf(blob, response.fileName);
          } catch (err) {
            this.isLoading = false;
            this.errorMessage = 'PDF ERROR: ' + ((err as Error)?.message || String(err));
          }
        },
        error: (err) => {
          console.error('[CNAM] API call failed:', err);
          this.isLoading = false;
          this.errorMessage = this.i18n.t('consultation.documents.toast.printFailed');
        },
      });
  }

  private async generateCnamPdf(response: CnamPrintDataResponse): Promise<Blob> {
    const pdfLib = await this.loadPdfLib();
    const templateResponse = await fetch(
      `${environment.apiUrl}/Cnam/${encodeURIComponent(response.templateFileName)}`,
    );

    if (!templateResponse.ok) {
      throw new Error('Unable to load CNAM template.');
    }

    const templateBytes = await templateResponse.arrayBuffer();
    const pdfDoc = await pdfLib.PDFDocument.load(templateBytes, { ignoreEncryption: true });
    const pages = pdfDoc.getPages();
    const targetPage = (pages[1] ?? pages[0]) as PdfPageLike;
    const font = (await pdfDoc.embedFont(pdfLib.StandardFonts.Helvetica)) as PdfFontLike;
    const fontSize = 9;

    switch (response.selectedFormType) {
      case 'ap2':
        this.drawCnamAp2(pdfLib, targetPage, font, fontSize, response);
        break;
      case 'ap3':
        this.drawCnamAp3(pdfLib, targetPage, font, fontSize, response);
        break;
      case 'ap4':
        this.drawCnamAp4(pdfLib, targetPage, font, fontSize, response);
        break;
      case 'apci':
        this.drawCnamApci(pdfLib, targetPage, font, response);
        break;
      default:
        this.drawCnamAp1(targetPage, font, fontSize, response);
        break;
    }

    const pdfBytes = await pdfDoc.save();
    return new Blob([pdfBytes], { type: 'application/pdf' });
  }

  private drawCnamAp1(
    page: PdfPageLike,
    font: PdfFontLike,
    fontSize: number,
    response: CnamPrintDataResponse,
  ): void {
    const medicationLines = response.ap1MedicationLines.slice(0, 4);
    const medicationRowsY = [323, 305, 287, 269];

    this.drawTextIfPresent(page, response.medecin, 1.7 * 72, 6.93 * 72, font, fontSize);
    this.drawTextIfPresent(page, response.patient, 2.5 * 72, 5.73 * 72, font, fontSize);
    this.drawTextIfPresent(page, response.codeConventionnel, 2.5 * 72, 6.05 * 72, font, fontSize);

    medicationLines.forEach((line: CnamMedicationLineResponse, index: number) => {
      const rowY = medicationRowsY[index];
      if (rowY === undefined) {
        return;
      }

      this.drawRawClippedText(page, line.code, 0.65 * 72, rowY, 56, font, fontSize);
      this.drawRawClippedText(page, line.designation, 1.62 * 72, rowY, 122, font, fontSize);
      this.drawRawClippedText(page, line.posologie, 3.26 * 72, rowY, 92, font, fontSize);
      this.drawRawClippedText(page, line.dureeTraitement, 4.75 * 72, rowY, 102, font, fontSize);
    });

    if (response.patientAge.trim()) {
      this.drawTextIfPresent(page, `Age : ${response.patientAge.trim()}`, 0.65 * 72, 2.95 * 72, font, fontSize);
    }

    this.drawWrappedMultilineRaw(
      page,
      font,
      fontSize,
      response.diagnostic,
      6.45 * 72,
      5.5 * 72,
      5,
      340,
    );

    this.drawWrappedMultilineRaw(
      page,
      font,
      fontSize,
      response.clinique,
      6.45 * 72,
      2.9 * 72,
      5,
      340,
    );

    this.drawWrappedMultilineRaw(
      page,
      font,
      fontSize,
      response.donneesCliniquesParacliniques,
      0.65 * 72,
      178,
      6,
      340,
    );
  }

  private drawCnamAp2(
    pdfLib: PdfLibNamespace,
    page: PdfPageLike,
    font: PdfFontLike,
    fontSize: number,
    response: CnamPrintDataResponse,
  ): void {
    const drawAtDisplayPoint = this.createRotatedCnamDrawer(pdfLib, page, font, fontSize);

    drawAtDisplayPoint(response.medecin, (1.65 * 72) + 20, (6.92 * 72) + 5);
    drawAtDisplayPoint(response.codeCnam, (2.45 * 72) + 20, 6.16 * 72);
    drawAtDisplayPoint(response.patient, 2.55 * 72, (5.72 * 72) + 21);
    this.drawWrappedAtDisplayPoint(drawAtDisplayPoint, font, fontSize, response.clinique, (6.42 * 72) + 20, (7.02 * 72) + 14, 5, 310);
    this.drawWrappedAtDisplayPoint(drawAtDisplayPoint, font, fontSize, response.diagnostic, (6.42 * 72) + 20, (4.96 * 72) + 31, 5, 310);
    this.drawWrappedAtDisplayPoint(drawAtDisplayPoint, font, fontSize, response.therapeutique, (6.42 * 72) + 20, (3.20 * 72) + 70, 5, 310);
    this.drawWrappedAtDisplayPoint(drawAtDisplayPoint, font, fontSize, response.natureExamen, (7.18 * 72) - 40, (1.93 * 72) + 14, 4, 170);
    this.drawWrappedAtDisplayPoint(drawAtDisplayPoint, font, fontSize, response.dateExamen, 10.28 * 72, (1.93 * 72) + 14, 4, 90);
  }

  private drawCnamAp3(
    pdfLib: PdfLibNamespace,
    page: PdfPageLike,
    font: PdfFontLike,
    fontSize: number,
    response: CnamPrintDataResponse,
  ): void {
    const drawAtDisplayPoint = this.createRotatedCnamDrawer(pdfLib, page, font, fontSize);

    drawAtDisplayPoint(response.medecin, (1.65 * 72) + 15, (6.92 * 72) + 18.5);
    drawAtDisplayPoint(response.codeCnam, (2.45 * 72) + 20, 6.16 * 72);
    drawAtDisplayPoint(response.patient, 2.55 * 72, (5.72 * 72) + 21 - 12.6);
    this.drawWrappedAtDisplayPoint(drawAtDisplayPoint, font, fontSize, response.donneesCliniquesParacliniques, (6.42 * 72) + 20, (7.02 * 72) + 28, 5, 310);
    this.drawWrappedAtDisplayPoint(drawAtDisplayPoint, font, fontSize, response.diagnostics, (6.42 * 72) + 20, (4.96 * 72) - 67 + 7, 5, 310);
  }

  private drawCnamAp4(
    pdfLib: PdfLibNamespace,
    page: PdfPageLike,
    font: PdfFontLike,
    fontSize: number,
    response: CnamPrintDataResponse,
  ): void {
    const drawAtDisplayPoint = this.createRotatedCnamDrawer(pdfLib, page, font, fontSize);
    const rightSideX = (6.42 * 72) + 20;

    drawAtDisplayPoint(response.medecin, 138.3, 501.24);
    drawAtDisplayPoint(response.codeCnam, (2.45 * 72) + 20, 6.16 * 72);
    drawAtDisplayPoint(response.patient, 208.35, 420.24);
    this.drawWrappedAtDisplayPoint(drawAtDisplayPoint, font, fontSize, response.pathologieOrigine, (1.5 * 72) - 49, 216.72, 5, 310);
    this.drawWrappedAtDisplayPoint(drawAtDisplayPoint, font, fontSize, response.traitement, rightSideX, 521.22, 5, 310);
    this.drawWrappedAtDisplayPoint(drawAtDisplayPoint, font, fontSize, response.etatSante, rightSideX - 10, 422.72, 5, 310);
    this.drawWrappedAtDisplayPoint(drawAtDisplayPoint, font, fontSize, response.bilanFonctionnel, rightSideX, 315, 5, 310);
    this.drawWrappedAtDisplayPoint(drawAtDisplayPoint, font, fontSize, response.prolongation, rightSideX, 214.2, 5, 310);
  }

  private drawCnamApci(
    pdfLib: PdfLibNamespace,
    page: PdfPageLike,
    font: PdfFontLike,
    response: CnamPrintDataResponse,
  ): void {
    const fontSize = 10;

    this.drawWrappedMultilineRotatedRaw(
      pdfLib,
      page,
      font,
      fontSize,
      response.diagnostic,
      95,
      522,
      19,
      310,
      2,
    );

    this.drawWrappedMultilineRotatedRaw(
      pdfLib,
      page,
      font,
      fontSize,
      response.observation,
      165,
      532,
      19,
      310,
      12,
    );
  }

  private createRotatedCnamDrawer(
    pdfLib: PdfLibNamespace,
    page: PdfPageLike,
    font: PdfFontLike,
    fontSize: number,
  ): (text: string, xDisplay: number, yDisplay: number) => void {
    const pageRotation = ((page.getRotation().angle % 360) + 360) % 360;
    const pageWidth = page.getWidth();
    const pageHeight = page.getHeight();

    return (text: string, xDisplay: number, yDisplay: number) => {
      const cleanText = text.trim();
      if (!cleanText) {
        return;
      }

      if (pageRotation === 90) {
        const displayWidth = pageHeight;
        const displayHeight = pageWidth;
        const mirroredX = displayWidth - xDisplay;
        const mirroredY = displayHeight - yDisplay;

        page.drawText(cleanText, {
          x: mirroredY,
          y: pageHeight - mirroredX,
          size: fontSize,
          font,
          rotate: pdfLib.degrees(90),
        });
        return;
      }

      page.drawText(cleanText, {
        x: xDisplay,
        y: yDisplay,
        size: fontSize,
        font,
      });
    };
  }

  private drawWrappedMultilineRaw(
    page: PdfPageLike,
    font: PdfFontLike,
    fontSize: number,
    text: string,
    x: number,
    y: number,
    lineGap = 5,
    maxLineWidth = 310,
  ): void {
    const paragraphs = text
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    if (paragraphs.length === 0) {
      return;
    }

    let currentY = y;
    for (const paragraph of paragraphs) {
      this.drawWrappedRaw(page, font, fontSize, paragraph, x, currentY, lineGap, maxLineWidth);
      currentY -= this.measureWrappedLineCount(font, fontSize, paragraph, maxLineWidth) * (fontSize + lineGap);
    }
  }

  private drawWrappedRaw(
    page: PdfPageLike,
    font: PdfFontLike,
    fontSize: number,
    text: string,
    x: number,
    y: number,
    lineGap = 5,
    maxLineWidth = 310,
  ): void {
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      return;
    }

    let line = '';
    let currentY = y;

    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(testLine, fontSize) > maxLineWidth) {
        if (line) {
          page.drawText(line, {
            x,
            y: currentY,
            size: fontSize,
            font,
          });
          currentY -= fontSize + lineGap;
        }
        line = word;
      } else {
        line = testLine;
      }
    }

    if (line) {
      page.drawText(line, {
        x,
        y: currentY,
        size: fontSize,
        font,
      });
    }
  }

  private drawRawClippedText(
    page: PdfPageLike,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    font: PdfFontLike,
    fontSize: number,
  ): void {
    const cleanText = text.trim();
    if (!cleanText) {
      return;
    }

    let clippedText = cleanText;
    while (clippedText && font.widthOfTextAtSize(clippedText, fontSize) > maxWidth) {
      clippedText = clippedText.slice(0, -1);
    }

    if (!clippedText) {
      return;
    }

    page.drawText(clippedText, {
      x,
      y,
      size: fontSize,
      font,
    });
  }

  private drawWrappedAtDisplayPoint(
    drawText: (text: string, xDisplay: number, yDisplay: number) => void,
    font: PdfFontLike,
    fontSize: number,
    text: string,
    x: number,
    y: number,
    lineGap = 5,
    maxLineWidth = 310,
  ): void {
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      return;
    }

    let line = '';
    let currentY = y;

    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(testLine, fontSize) > maxLineWidth) {
        if (line) {
          drawText(line, x, currentY);
          currentY -= fontSize + lineGap;
        }
        line = word;
      } else {
        line = testLine;
      }
    }

    if (line) {
      drawText(line, x, currentY);
    }
  }

  private drawWrappedMultilineAtDisplayPoint(
    drawText: (text: string, xDisplay: number, yDisplay: number) => void,
    font: PdfFontLike,
    fontSize: number,
    text: string,
    x: number,
    y: number,
    lineGap = 5,
    maxLineWidth = 310,
  ): void {
    const paragraphs = text
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    if (paragraphs.length === 0) {
      return;
    }

    let currentY = y;
    for (const paragraph of paragraphs) {
      this.drawWrappedAtDisplayPoint(drawText, font, fontSize, paragraph, x, currentY, lineGap, maxLineWidth);
      currentY -= this.measureWrappedLineCount(font, fontSize, paragraph, maxLineWidth) * (fontSize + lineGap);
    }
  }

  private drawWrappedMultilineRotatedRaw(
    pdfLib: PdfLibNamespace,
    page: PdfPageLike,
    font: PdfFontLike,
    fontSize: number,
    text: string,
    x: number,
    y: number,
    lineAdvance = 19,
    maxLineWidth = 310,
    maxLines?: number,
  ): void {
    const paragraphs = text
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter((item) => item.length > 0);

    if (paragraphs.length === 0) {
      return;
    }

    let currentX = x;
    let renderedLines = 0;

    for (const paragraph of paragraphs) {
      const lines = this.wrapTextLines(font, fontSize, paragraph, maxLineWidth);
      for (const line of lines) {
        if (!line) {
          continue;
        }

        if (maxLines !== undefined && renderedLines >= maxLines) {
          return;
        }

        page.drawText(line, {
          x: currentX,
          y,
          size: fontSize,
          font,
          rotate: pdfLib.degrees(90),
        });

        currentX += lineAdvance;
        renderedLines += 1;
      }
    }
  }

  private measureWrappedLineCount(
    font: PdfFontLike,
    fontSize: number,
    text: string,
    maxLineWidth: number,
  ): number {
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      return 0;
    }

    let line = '';
    let lineCount = 0;

    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(testLine, fontSize) > maxLineWidth) {
        if (line) {
          lineCount += 1;
        }
        line = word;
      } else {
        line = testLine;
      }
    }

    return line ? lineCount + 1 : lineCount;
  }

  private wrapTextLines(
    font: PdfFontLike,
    fontSize: number,
    text: string,
    maxLineWidth: number,
  ): string[] {
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      return [];
    }

    const lines: string[] = [];
    let line = '';

    for (const word of words) {
      const testLine = line ? `${line} ${word}` : word;
      if (line && font.widthOfTextAtSize(testLine, fontSize) > maxLineWidth) {
        lines.push(line);
        line = word;
      } else {
        line = testLine;
      }
    }

    if (line) {
      lines.push(line);
    }

    return lines;
  }

  private drawTextIfPresent(
    page: PdfPageLike,
    text: string,
    x: number,
    y: number,
    font: PdfFontLike,
    fontSize: number,
  ): void {
    const cleanText = text.trim();
    if (!cleanText) {
      return;
    }

    page.drawText(cleanText, {
      x,
      y,
      size: fontSize,
      font,
    });
  }

  private renderPrintablePdf(blob: Blob, fileName: string): void {
    const objectUrl = URL.createObjectURL(blob);
    const printLabel = this.i18n.t('consultation.documents.actions.print');
    const fallbackLabel = this.i18n.lang() === 'en'
      ? 'Open PDF'
      : this.i18n.lang() === 'ar'
        ? 'فتح PDF'
        : 'Ouvrir le PDF';

    this.renderPrintableHtml(`<!doctype html>
<html lang="${this.escapeHtml(this.i18n.lang())}">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${this.escapeHtml(fileName)}</title>
  <style>
    body { margin: 0; background: #f5f5f5; font-family: "Segoe UI", Roboto, sans-serif; }
    .toolbar {
      position: fixed;
      top: 12px;
      right: 12px;
      z-index: 1000;
      display: flex;
      gap: 8px;
    }
    .toolbar a,
    .toolbar button {
      border: 1px solid #8faa83;
      background: #9eb895;
      color: #fff;
      border-radius: 4px;
      padding: 0.45rem 1rem;
      font-size: 0.92rem;
      cursor: pointer;
      text-decoration: none;
    }
    iframe {
      width: 100vw;
      height: 100vh;
      border: 0;
      background: #fff;
    }
    @media print {
      .toolbar { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="toolbar">
    <a href="${objectUrl}" target="_blank" rel="noopener noreferrer">${this.escapeHtml(fallbackLabel)}</a>
    <button type="button" onclick="window.__retryPrint && window.__retryPrint()">${this.escapeHtml(printLabel)}</button>
  </div>
  <iframe id="cnam-pdf-frame" src="${objectUrl}" title="${this.escapeHtml(fileName)}"></iframe>
  <script>
    (function () {
      var frame = document.getElementById('cnam-pdf-frame');
      var hasAutoPrinted = false;
      var objectUrl = ${JSON.stringify(objectUrl)};

      function doPrint() {
        try {
          if (frame && frame.contentWindow) {
            frame.contentWindow.focus();
            frame.contentWindow.print();
            return;
          }
        } catch (error) {
          // Ignore and allow manual retry.
        }

        try {
          window.print();
        } catch (error) {
          // Ignore browser-level print errors.
        }
      }

      function autoPrintOnce() {
        if (hasAutoPrinted) {
          return;
        }

        hasAutoPrinted = true;
        setTimeout(doPrint, 200);
      }

      window.__retryPrint = doPrint;

      if (frame) {
        frame.addEventListener('load', autoPrintOnce, { once: true });
      } else {
        window.addEventListener('load', autoPrintOnce, { once: true });
      }

      window.addEventListener('beforeunload', function () {
        try {
          URL.revokeObjectURL(objectUrl);
        } catch (error) {
          // Ignore cleanup failures.
        }
      });
    })();
  </script>
</body>
</html>`);
  }

  private async loadPdfLib(): Promise<PdfLibNamespace> {
    const existing = (window as WindowWithPdfLib).PDFLib;
    if (existing) {
      return existing;
    }

    await new Promise<void>((resolve, reject) => {
      const script = document.createElement('script');
      script.src = '/vendor/pdf-lib.min.js';
      script.async = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('Unable to load pdf-lib.'));
      document.head.appendChild(script);
    });

    const loaded = (window as WindowWithPdfLib).PDFLib;
    if (!loaded) {
      throw new Error('pdf-lib was not loaded.');
    }

    return loaded;
  }

  private printLettreConfrereFromFrontend(consultationId: string, lang: Lang): void {
    forkJoin({
      conduite: this.conduiteService.getConsultationConduite(consultationId),
      doctor: this.loadDoctorPrintInfo(),
    })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: ({ conduite, doctor }) => {
          const payload = this.resolveLettrePayload(conduite);
          const html = this.buildFrontendLettrePrintableHtml(payload, lang, doctor);
          this.renderPrintableHtml(html);
        },
        error: () => {
          this.isLoading = false;
          this.errorMessage = this.i18n.t('consultation.documents.toast.printFailed');
        },
      });
  }

  private loadDoctorPrintInfo(): Observable<DoctorPrintInfo | null> {
    return this.authService.getAuthenticatedAccount().pipe(
      switchMap((account) => this.resolveDoctorProfile(account)),
      catchError(() => of(null)),
    );
  }

  private resolveDoctorProfile(
    account: AuthenticatedAccountResponse,
  ): Observable<DoctorPrintInfo | null> {
    const candidateIds = [account.id, account.doctorId]
      .map((value) => (value ?? '').trim())
      .filter((value, index, array) => value.length > 0 && array.indexOf(value) === index);

    if (candidateIds.length === 0) {
      return of(this.mapAccountToDoctorPrintInfo(account));
    }

    return this.doctorService.getById(candidateIds[0]).pipe(
      map((profile) => this.mapProfileToDoctorPrintInfo(profile)),
      catchError(() => {
        if (candidateIds.length < 2) {
          return of(this.mapAccountToDoctorPrintInfo(account));
        }

        return this.doctorService.getById(candidateIds[1]).pipe(
          map((profile) => this.mapProfileToDoctorPrintInfo(profile)),
          catchError(() => of(this.mapAccountToDoctorPrintInfo(account))),
        );
      }),
    );
  }

  private mapProfileToDoctorPrintInfo(profile: DoctorProfile): DoctorPrintInfo {
    const personalization = profile.personalization;

    return {
      firstName: profile.firstName,
      lastName: profile.lastName,
      firstNameAr: profile.firstNameInArabic ?? '',
      lastNameAr: profile.lastNameInArabic ?? '',
      codeCnam: profile.codeCnam,
      cabinetAddress: profile.cabinetAddress,
      city: profile.city,
      landline: profile.landline,
      phoneNumber: profile.phoneNumber,
      showHeader: personalization.showHeader,
      showFooter: personalization.showFooter,
      showFirstName: personalization.showFirstName,
      showLastName: personalization.showLastName,
      showCodeCnam: personalization.showCodeCnam,
      showFirstNameArabic: personalization.showFirstNameArabic,
      showLastNameArabic: personalization.showLastNameArabic,
      showFooterCabinetAddress: personalization.showFooterCabinetAddress,
      showFooterLandline: personalization.showFooterLandline,
      showFooterMobile: personalization.showFooterMobile,
    };
  }

  private mapAccountToDoctorPrintInfo(account: AuthenticatedAccountResponse): DoctorPrintInfo {
    return {
      firstName: account.firstname ?? '',
      lastName: account.lastname ?? '',
      firstNameAr: '',
      lastNameAr: '',
      codeCnam: '',
      cabinetAddress: '',
      city: 'Tunis',
      landline: '',
      phoneNumber: '',
      showHeader: true,
      showFooter: true,
      showFirstName: true,
      showLastName: true,
      showCodeCnam: true,
      showFirstNameArabic: false,
      showLastNameArabic: false,
      showFooterCabinetAddress: true,
      showFooterLandline: true,
      showFooterMobile: true,
    };
  }

  private resolveLettrePayload(response: ConsultationConduiteResponse): Record<string, unknown> {
    const action = response.actions.find(
      (item) => this.normalizeActionKey(item.actionKey) === 'lettre_confrere',
    );

    if (!action || !action.payload || typeof action.payload !== 'object') {
      return {};
    }

    return action.payload;
  }

  private normalizeActionKey(value: string): string {
    return value.trim().toLowerCase().replace(/[\s-]+/g, '_');
  }

  private buildFrontendLettrePrintableHtml(
    payload: Record<string, unknown>,
    lang: Lang,
    doctor: DoctorPrintInfo | null,
  ): string {
    const title = this.i18n.t('consultation.documents.types.lettreConfrere');
    const recipient = this.readString(payload['medecin']);
    const formality = this.resolveFormalityForPrint(payload, lang);
    const contentRaw = this.readString(payload['contenue']);
    const contentHtml = this.buildLetterContentHtml(contentRaw);

    const printLabel =
      lang === 'ar' ? 'طباعة' : lang === 'en' ? 'Print' : 'Imprimer';

    const pageLanguage = lang;
    const printedDate = new Date().toLocaleDateString(
      lang === 'ar' ? 'ar-TN' : lang === 'en' ? 'en-US' : 'fr-FR',
      {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      },
    );

    const city = (doctor?.city ?? '').trim() || 'Tunis';
    const datePrefix = lang === 'en' ? `${city} on` : lang === 'ar' ? `${city} في` : `${city} le`;

    const doctorNameLeft = `Dr. ${[
      doctor?.showFirstName !== false ? doctor?.firstName ?? '' : '',
      doctor?.showLastName !== false ? doctor?.lastName ?? '' : '',
    ]
      .join(' ')
      .trim()}`.trim();

    const doctorNameRight = `الدكتور ${[
      doctor?.showLastNameArabic ? doctor?.lastNameAr ?? '' : '',
      doctor?.showFirstNameArabic ? doctor?.firstNameAr ?? '' : '',
    ]
      .join(' ')
      .trim()}`.trim();

    const codeCnam = doctor?.showCodeCnam === false ? '' : (doctor?.codeCnam ?? '').trim();
    const codeCnamDisplay = codeCnam || '..........................';
    const specialite =
      lang === 'ar' ? 'طبيب' : lang === 'en' ? 'Doctor' : 'Medecin';

    const footerAddress = doctor?.showFooterCabinetAddress
      ? [doctor?.cabinetAddress ?? '', doctor?.city ?? '']
          .map((item) => item.trim())
          .filter((item) => item.length > 0)
          .join(', ')
      : '';
    const footerLandline = doctor?.showFooterLandline ? (doctor?.landline ?? '').trim() : '';
    const footerPhone = doctor?.showFooterMobile ? (doctor?.phoneNumber ?? '').trim() : '';

    const headerHtml = doctor?.showHeader === false
      ? ''
      : `
    <header class="header">
      <div class="header-col header-left">
        <ul>
          ${doctorNameLeft ? `<li><strong>${this.escapeHtml(doctorNameLeft)}</strong></li>` : ''}
          ${doctorNameLeft ? '<hr class="my-1 bold-line" />' : ''}
          <li><strong class="letter-spacing">${this.escapeHtml(specialite)}</strong></li>
        </ul>
      </div>
      <div class="header-col header-center">
        <p class="code-cnam"><strong>Code CNAM : ${this.escapeHtml(codeCnamDisplay)}</strong></p>
      </div>
      <div class="header-col header-right">
        <ul>
          ${doctorNameRight !== 'الدكتور' ? `<li><strong>${this.escapeHtml(doctorNameRight)}</strong></li>` : ''}
          ${doctorNameRight !== 'الدكتور' ? '<hr class="my-1 bold-line" />' : ''}
          <li><strong>${this.escapeHtml(lang === 'ar' ? 'طبيب أمراض جلدية' : 'Dermatologue')}</strong></li>
        </ul>
      </div>
    </header>`;

    const footerHtml = doctor?.showFooter === false
      ? ''
      : `
    <footer id="footer-cont">
      <hr class="my-1 bold-line footer-line" />
      ${footerAddress ? `<p class="my-0">${this.escapeHtml(footerAddress)}</p>` : ''}
      <p class="my-0">
        ${footerLandline ? `<span class="footer-contact">&#9742; ${this.escapeHtml(footerLandline)}</span>` : ''}
        ${footerPhone ? `<span class="footer-contact">&#128241; ${this.escapeHtml(footerPhone)}</span>` : ''}
      </p>
    </footer>`;

    return `<!DOCTYPE html>
<html lang="${this.escapeHtml(pageLanguage)}" dir="ltr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${this.escapeHtml(title)}</title>
  <style>
    :root {
      color-scheme: light;
    }
    * {
      box-sizing: border-box;
    }
    body {
      margin: 0;
      padding: 0;
      background: #fff;
      font-family: "Segoe UI", Roboto, sans-serif;
      color: #000;
    }
    ul {
      margin: 0;
      padding: 0;
      list-style-type: none;
    }
    .print-toolbar {
      position: fixed;
      top: 12px;
      inset-inline-end: 12px;
      z-index: 999;
    }
    .print-toolbar-btn {
      border: 1px solid #8faa83;
      background: #9eb895;
      color: #fff;
      border-radius: 4px;
      padding: 0.42rem 1.05rem;
      font-size: 0.9rem;
      cursor: pointer;
    }
    .print-page {
      width: 210mm;
      min-height: 297mm;
      margin: 0 auto;
      background: #fff;
      padding: 10mm 8mm 8mm;
      display: flex;
      flex-direction: column;
    }
    .header {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      min-height: 110px;
      align-items: start;
      padding: 0 12px;
    }
    .header-col {
      font-size: 12px;
    }
    .header-center {
      text-align: center;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .header-right {
      text-align: right;
    }
    .bold-line {
      border: 0;
      border-top: 2px solid #8d8d8d;
      margin-top: 4px;
      margin-bottom: 4px;
    }
    .letter-spacing {
      letter-spacing: 3px;
    }
    .main-content {
      padding-left: 3.2rem;
      padding-right: 1.5rem;
      min-height: 720px;
      margin-top: 20px;
    }
    .page-title {
      margin: 0;
      text-align: center;
      color: #000;
      font-weight: 500;
      font-size: 44px;
    }
    .meta-line {
      margin: 0.2rem 0;
      font-size: 20px;
    }
    .meta-label {
      font-weight: 700;
    }
    .date-line {
      margin-top: 12px;
      margin-bottom: 24px;
      text-align: right;
      font-weight: 600;
      font-size: 18px;
    }
    .salutation,
    .recipient-line {
      font-size: 20px;
      font-weight: 600;
      margin-top: 10px;
      margin-bottom: 0;
    }
    .lettre-content {
      margin-top: 24px;
      line-height: 1.45;
      font-size: 20px;
      font-weight: 600;
      min-height: 250px;
    }
    .lettre-content p {
      margin-top: 0;
    }
    .dots-line {
      letter-spacing: 3px;
      white-space: nowrap;
      overflow: hidden;
    }
    #footer-cont {
      margin-top: auto;
      text-align: center;
      padding-bottom: 8px;
      font-size: 12px;
    }
    .footer-line {
      width: 82%;
      margin-left: auto;
      margin-right: auto;
    }
    .footer-contact {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      margin: 0 8px;
    }
    @page {
      size: A4;
      margin: 8mm;
    }
    @media print {
      body {
        background: #fff;
      }
      .print-toolbar {
        display: none !important;
      }
      .print-page {
        width: auto;
        min-height: auto;
        margin: 0;
        padding: 0;
      }
    }
  </style>
</head>
<body>
  <div class="print-toolbar no-print">
    <button type="button" class="print-toolbar-btn" onclick="window.__retryPrint && window.__retryPrint()">${this.escapeHtml(printLabel)}</button>
  </div>

  <div class="print-page">
    ${headerHtml}

    <main class="main-content">
    <h1 class="page-title">${this.escapeHtml(lang === 'en' ? 'Letter to colleague' : lang === 'ar' ? 'رسالة إلى زميل' : 'Lettre pour confrère')}</h1>
    <p class="date-line">${this.escapeHtml(`${datePrefix} ${printedDate}`)}</p>
    <p class="salutation"><b>${this.escapeHtml(formality)},</b></p>
    ${recipient ? `<p class="recipient-line"><b>${this.escapeHtml(recipient)}</b></p>` : ''}
    <div class="lettre-content">${contentHtml}</div>
    </main>

    ${footerHtml}
  </div>

  <script>
    (function () {
      var hasAutoPrinted = false;

      function doPrint() {
        try {
          window.print();
        } catch (error) {
          // Ignore browser-level print errors and allow manual retry.
        }
      }

      function autoPrintOnce() {
        if (hasAutoPrinted) {
          return;
        }

        hasAutoPrinted = true;
        doPrint();
      }

      window.__retryPrint = doPrint;
      if (document.readyState === 'complete') {
        setTimeout(autoPrintOnce, 180);
      } else {
        window.addEventListener('load', function () {
          setTimeout(autoPrintOnce, 180);
        }, { once: true });
      }
    })();
  </script>
</body>
</html>`;
  }

  private resolveFormalityForPrint(payload: Record<string, unknown>, lang: Lang): string {
    const formalityKey = this.readString(payload['formalityKey'])
      .trim()
      .toLowerCase();

    if (lang === 'en') {
      return 'Dear colleague';
    }

    if (lang === 'ar') {
      return formalityKey === 'consoeur' ? 'زميلتي العزيزة' : 'زميلي العزيز';
    }

    return formalityKey === 'consoeur' ? 'Chère consœur' : 'Cher confrère';
  }

  private buildLetterContentHtml(rawContent: string): string {
    if (!rawContent.trim()) {
      return `<p class="dots-line">..................................................................................................................................................................................</p>`;
    }

    if (!this.looksLikeHtml(rawContent)) {
      return `<p>${this.nl2br(rawContent)}</p>`;
    }

    const sanitized = this.sanitizeLetterHtml(rawContent);
    if (!sanitized.trim()) {
      return `<p class="dots-line">..................................................................................................................................................................................</p>`;
    }

    return sanitized;
  }

  private sanitizeLetterHtml(rawHtml: string): string {
    const parser = new DOMParser();
    const parsed = parser.parseFromString(`<div id="lettre-content-root">${rawHtml}</div>`, 'text/html');
    const root = parsed.getElementById('lettre-content-root');

    if (!root) {
      return '';
    }

    root
      .querySelectorAll(
        'script,style,iframe,object,embed,form,input,button,textarea,svg,math,link,meta',
      )
      .forEach((element) => element.remove());

    root.querySelectorAll('*').forEach((element) => {
      for (const attribute of Array.from(element.attributes)) {
        const name = attribute.name.toLowerCase();
        const value = attribute.value.toLowerCase();

        if (name.startsWith('on')) {
          element.removeAttribute(attribute.name);
          continue;
        }

        if ((name === 'href' || name === 'src') && value.trim().startsWith('javascript:')) {
          element.removeAttribute(attribute.name);
        }
      }
    });

    return root.innerHTML.trim();
  }

  private looksLikeHtml(value: string): boolean {
    return /<[^>]+>/.test(value);
  }

  private readString(value: unknown): string {
    if (typeof value === 'string') {
      return value.trim();
    }

    if (typeof value === 'number') {
      return String(value);
    }

    return '';
  }

  private nl2br(value: string): string {
    return this.escapeHtml(value).replace(/\n/g, '<br />');
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  private normalizeDocumentType(value: string): ConduiteDocumentType | null {
    const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, '_');

    if (
      normalized === 'ordonnance' ||
      normalized === 'certificat' ||
      normalized === 'lettre_confrere' ||
      normalized === 'cnam' ||
      normalized === 'paraclinique'
    ) {
      return normalized;
    }

    return null;
  }

  private parseParacliniqueSections(value: string | null): ParacliniquePrintSection[] {
    if (!value) {
      return [];
    }

    const parsed = value
      .split(',')
      .map((entry) => entry.trim().toLowerCase().replace(/[\s-]+/g, '_'))
      .filter((entry): entry is ParacliniquePrintSection => (
        entry === 'chirurgie' || entry === 'laser' || entry === 'imagerie' || entry === 'bilan_sanguin'
      ));

    return parsed.filter((entry, index) => parsed.indexOf(entry) === index);
  }

  private normalizeLang(value: string): Lang {
    const normalized = value.trim().toLowerCase();

    if (normalized.startsWith('ar')) {
      return 'ar';
    }

    if (normalized.startsWith('en')) {
      return 'en';
    }

    return 'fr';
  }
}
