'use client';

import { useEffect, useRef, useState } from 'react';
import type { PointerEvent, ReactNode } from 'react';
import Image from 'next/image';
import { CheckCircle2, LoaderCircle, PenLine, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { invoicesApi } from '@/features/invoices/api/invoices-api';
import type { PublicInvoiceRecord } from '@/features/invoices/types/invoice.types';
import { toast } from '@/lib/stores/toast.store';
import { cn } from '@/lib/utils/cn';
import { createInvoicePdfBlob, InvoiceDocument } from './InvoiceActions';

export function InvoiceSigningPage({ token }: { token: string }) {
  const [invoice, setInvoice] = useState<PublicInvoiceRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signatureName, setSignatureName] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasDrawing, setHasDrawing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const invoiceDocumentRef = useRef<HTMLDivElement>(null);
  const isDrawingRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    invoicesApi
      .getBySigningToken(token)
      .then((loadedInvoice) => {
        if (!isMounted) {
          return;
        }

        setInvoice(loadedInvoice);
        setSignatureName(loadedInvoice.customerSignature ?? loadedInvoice.customerName);
      })
      .catch((caughtError) => {
        if (!isMounted) {
          return;
        }

        setError(
          caughtError instanceof Error
            ? caughtError.message
            : 'Unable to load this invoice signing link.',
        );
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [token]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || invoice?.canSign === false) {
      return;
    }

    const context = canvas.getContext('2d');
    if (!context) {
      return;
    }

    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    context.scale(ratio, ratio);
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.lineWidth = 2.4;
    context.strokeStyle = '#172334';
  }, [invoice?.canSign]);

  const startDrawing = (event: PointerEvent<HTMLCanvasElement>) => {
    const context = canvasRef.current?.getContext('2d');
    if (!context) {
      return;
    }

    isDrawingRef.current = true;
    const point = getCanvasPoint(event);
    context.beginPath();
    context.moveTo(point.x, point.y);
  };

  const drawSignature = (event: PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawingRef.current) {
      return;
    }

    const context = canvasRef.current?.getContext('2d');
    if (!context) {
      return;
    }

    const point = getCanvasPoint(event);
    context.lineTo(point.x, point.y);
    context.stroke();
    setHasDrawing(true);
  };

  const stopDrawing = () => {
    isDrawingRef.current = false;
  };

  const clearSignature = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');

    if (!canvas || !context) {
      return;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawing(false);
  };

  const submitSignature = async () => {
    if (!invoice || !canvasRef.current) {
      return;
    }

    if (!signatureName.trim()) {
      toast.error('Signature name required', 'Enter your name before signing.');
      return;
    }

    if (!hasDrawing) {
      toast.error('Signature required', 'Please draw your signature before submitting.');
      return;
    }

    setIsSubmitting(true);

    try {
      const signatureImage = canvasRef.current.toDataURL('image/png');
      const signedAt = new Date().toISOString();
      const signedPreview = {
        ...invoice,
        customerSignature: signatureName.trim(),
        customerSignatureImage: signatureImage,
        signatureDate: signedAt,
        signedAt,
        status: 'SIGNED',
        canSign: false,
      };

      setInvoice(signedPreview);
      await waitForRenderFrame();

      const signedInvoicePdfBase64 = invoiceDocumentRef.current
        ? await blobToBase64(await createInvoicePdfBlob(invoiceDocumentRef.current))
        : undefined;

      const signedInvoice = await invoicesApi.signWithToken(token, {
        customerSignature: signatureName.trim(),
        customerSignatureImage: signatureImage,
        signedInvoicePdfBase64,
      });
      setInvoice(signedInvoice);
      toast.success('Invoice signed', 'Your signed invoice has been received.');
    } catch (caughtError) {
      setInvoice(invoice);
      toast.error(
        'Unable to sign invoice',
        caughtError instanceof Error
          ? caughtError.message
          : 'Please try again in a moment.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <SigningShell>
        <Card className="mx-auto max-w-xl border-border/70 bg-white/95">
          <CardContent className="flex items-center gap-3 p-6 text-sm text-muted-foreground">
            <LoaderCircle className="h-4 w-4 animate-spin" />
            Loading invoice...
          </CardContent>
        </Card>
      </SigningShell>
    );
  }

  if (error || !invoice) {
    return (
      <SigningShell>
        <Card className="mx-auto max-w-xl border-destructive/30 bg-white/95">
          <CardHeader>
            <CardTitle>Invoice link unavailable</CardTitle>
            <CardDescription>{error ?? 'This invoice link cannot be opened.'}</CardDescription>
          </CardHeader>
        </Card>
      </SigningShell>
    );
  }

  const isSigned = invoice.status === 'SIGNED';

  return (
    <SigningShell>
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <div className="overflow-auto rounded-2xl border border-border/70 bg-slate-100 p-3">
          <InvoiceDocument ref={invoiceDocumentRef} invoice={invoice} />
        </div>

        <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          <Card className="border-border/70 bg-white/95">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl">
                {isSigned ? (
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                ) : (
                  <PenLine className="h-5 w-5 text-primary" />
                )}
                {isSigned ? 'Invoice Signed' : 'Review & Sign'}
              </CardTitle>
              <CardDescription>
                Invoice #{invoice.invoiceNumber}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isSigned ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  This invoice has been signed and is now read-only.
                </div>
              ) : (
                <>
                  <label className="space-y-1.5 text-sm font-medium text-foreground">
                    <span>Signature Name</span>
                    <input
                      value={signatureName}
                      onChange={(event) => setSignatureName(event.target.value)}
                      className="w-full rounded-2xl border border-input bg-white px-4 py-2.5 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    />
                  </label>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-foreground">Draw Signature</p>
                      <Button type="button" variant="ghost" size="sm" onClick={clearSignature}>
                        <RotateCcw className="h-4 w-4" />
                        Clear
                      </Button>
                    </div>
                    <canvas
                      ref={canvasRef}
                      onPointerDown={startDrawing}
                      onPointerMove={drawSignature}
                      onPointerUp={stopDrawing}
                      onPointerLeave={stopDrawing}
                      className={cn(
                        'h-44 w-full touch-none rounded-2xl border border-dashed border-slate-300 bg-white shadow-inner',
                        hasDrawing ? 'border-primary/60' : null,
                      )}
                    />
                  </div>

                  <Button
                    type="button"
                    className="w-full"
                    disabled={isSubmitting}
                    onClick={submitSignature}
                  >
                    {isSubmitting ? (
                      <>
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                        Signing...
                      </>
                    ) : (
                      <>
                        <PenLine className="h-4 w-4" />
                        Sign Invoice
                      </>
                    )}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        </aside>
      </div>
    </SigningShell>
  );
}

function SigningShell({ children }: { children: ReactNode }) {
  return (
    <section className="min-h-screen bg-[linear-gradient(180deg,#f7fafc_0%,#edf2f7_100%)] px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex flex-col items-center gap-3 text-center">
          <Image
            src="/images/logo.png"
            alt="MEE Auto Parts"
            width={260}
            height={80}
            priority
            className="h-auto w-[220px] sm:w-[260px]"
          />
        </div>
        {children}
      </div>
    </section>
  );
}

function getCanvasPoint(event: PointerEvent<HTMLCanvasElement>) {
  const rect = event.currentTarget.getBoundingClientRect();

  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

function waitForRenderFrame() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => resolve());
    });
  });
}

function blobToBase64(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Unable to prepare signed invoice PDF.'));
        return;
      }

      resolve(result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('Unable to read signed invoice PDF.'));
    reader.readAsDataURL(blob);
  });
}
