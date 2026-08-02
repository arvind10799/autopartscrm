'use client';

import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent, PointerEvent, ReactNode } from 'react';
import Image from 'next/image';
import {
  CheckCircle2,
  FileUp,
  LoaderCircle,
  PenLine,
  RotateCcw,
  UploadCloud,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { invoicesApi } from '@/features/invoices/api/invoices-api';
import type { PublicInvoiceRecord } from '@/features/invoices/types/invoice.types';
import { toast } from '@/lib/stores/toast.store';
import { cn } from '@/lib/utils/cn';
import { createInvoicePdfBlob, InvoiceDocument } from './InvoiceActions';

type SignatureMode = 'TYPE' | 'DRAW' | 'UPLOAD';

const TYPED_SIGNATURE_STYLES = [
  { label: 'Classic Script', font: '"Brush Script MT", "Segoe Script", cursive' },
  { label: 'Elegant Script', font: '"Lucida Handwriting", "Segoe Script", cursive' },
  { label: 'Modern Script', font: '"Segoe Script", "Brush Script MT", cursive' },
  { label: 'Bold Script', font: '"Monotype Corsiva", "Brush Script MT", cursive' },
];

export function InvoiceSigningPage({ token }: { token: string }) {
  const [invoice, setInvoice] = useState<PublicInvoiceRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [signatureName, setSignatureName] = useState('');
  const [signatureImage, setSignatureImage] = useState('');
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [signatureMode, setSignatureMode] = useState<SignatureMode>('TYPE');
  const [selectedTypedStyle, setSelectedTypedStyle] = useState(0);
  const [uploadedSignatureImage, setUploadedSignatureImage] = useState('');
  const [photoIdDocument, setPhotoIdDocument] = useState('');
  const [photoIdFileName, setPhotoIdFileName] = useState('');
  const [photoIdMimeType, setPhotoIdMimeType] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasDrawing, setHasDrawing] = useState(false);
  const drawCanvasRef = useRef<HTMLCanvasElement>(null);
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
        setSignatureImage(loadedInvoice.customerSignatureImage ?? '');
        setPhotoIdDocument(loadedInvoice.photoIdDocument ?? '');
        setPhotoIdFileName(loadedInvoice.photoIdFileName ?? '');
        setPhotoIdMimeType(loadedInvoice.photoIdMimeType ?? '');
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
    const canvas = drawCanvasRef.current;
    if (
      !canvas ||
      invoice?.canSign === false ||
      !isSignatureModalOpen ||
      signatureMode !== 'DRAW'
    ) {
      return;
    }

    prepareSignatureCanvas(canvas);
    setHasDrawing(false);
  }, [invoice?.canSign, isSignatureModalOpen, signatureMode]);

  const startDrawing = (event: PointerEvent<HTMLCanvasElement>) => {
    const context = drawCanvasRef.current?.getContext('2d');
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

    const context = drawCanvasRef.current?.getContext('2d');
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
    const canvas = drawCanvasRef.current;
    const context = canvas?.getContext('2d');

    if (!canvas || !context) {
      return;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawing(false);
  };

  const openSignatureModal = () => {
    setSignatureMode(signatureImage ? 'DRAW' : 'TYPE');
    setIsSignatureModalOpen(true);
  };

  const handleSignatureFile = async (file: File | undefined) => {
    if (!file) {
      return;
    }

    if (!['image/png', 'image/jpeg', 'image/bmp'].includes(file.type)) {
      toast.error('Unsupported file', 'Upload a PNG, JPG, or BMP signature image.');
      return;
    }

    try {
      const image = await fileToCompressedSignatureDataUrl(file);
      setUploadedSignatureImage(image);
    } catch (caughtError) {
      toast.error(
        'Unable to upload signature',
        caughtError instanceof Error ? caughtError.message : 'Please try another image.',
      );
    }
  };

  const handleUploadInput = (event: ChangeEvent<HTMLInputElement>) => {
    void handleSignatureFile(event.target.files?.[0]);
    event.target.value = '';
  };

  const handleDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    void handleSignatureFile(event.dataTransfer.files?.[0]);
  };

  const handlePhotoIdFile = async (file: File | undefined) => {
    if (!file) {
      return;
    }

    const supportedTypes = [
      'image/png',
      'image/jpeg',
      'image/bmp',
      'image/webp',
      'application/pdf',
    ];

    if (!supportedTypes.includes(file.type)) {
      toast.error('Unsupported photo ID', 'Upload a PNG, JPG, BMP, WEBP, or PDF file.');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('Photo ID too large', 'Upload a photo ID file smaller than 5 MB.');
      return;
    }

    try {
      const document = await fileToDataUrl(file);
      setPhotoIdDocument(document);
      setPhotoIdFileName(file.name);
      setPhotoIdMimeType(file.type);
    } catch (caughtError) {
      toast.error(
        'Unable to upload photo ID',
        caughtError instanceof Error ? caughtError.message : 'Please try another file.',
      );
    }
  };

  const handlePhotoIdInput = (event: ChangeEvent<HTMLInputElement>) => {
    void handlePhotoIdFile(event.target.files?.[0]);
    event.target.value = '';
  };

  const handlePhotoIdDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    void handlePhotoIdFile(event.dataTransfer.files?.[0]);
  };

  const saveSignatureFromModal = () => {
    const trimmedName = signatureName.trim();

    if (!trimmedName) {
      toast.error('Signature name required', 'Enter your name before saving signature.');
      return;
    }

    if (signatureMode === 'TYPE') {
      setSignatureImage(createTypedSignatureImage(trimmedName, selectedTypedStyle));
      setIsSignatureModalOpen(false);
      return;
    }

    if (signatureMode === 'DRAW') {
      if (!drawCanvasRef.current || !hasDrawing) {
        toast.error('Signature required', 'Draw your signature before saving.');
        return;
      }

      setSignatureImage(drawCanvasRef.current.toDataURL('image/png'));
      setIsSignatureModalOpen(false);
      return;
    }

    if (!uploadedSignatureImage) {
      toast.error('Signature required', 'Upload your signature before saving.');
      return;
    }

    setSignatureImage(uploadedSignatureImage);
    setIsSignatureModalOpen(false);
  };

  const submitSignature = async () => {
    if (!invoice) {
      return;
    }

    if (!signatureName.trim()) {
      toast.error('Signature name required', 'Enter your name before signing.');
      return;
    }

    if (!signatureImage) {
      toast.error('Signature required', 'Add your signature before submitting.');
      return;
    }

    if (invoice.photoIdRequired && !photoIdDocument) {
      toast.error('Photo ID required', 'Upload your photo ID before signing.');
      return;
    }

    setIsSubmitting(true);

    try {
      const signedAt = new Date().toISOString();
      const signedPreview = {
        ...invoice,
        customerSignature: signatureName.trim(),
        customerSignatureImage: signatureImage,
        photoIdDocument: photoIdDocument || null,
        photoIdFileName: photoIdFileName || null,
        photoIdMimeType: photoIdMimeType || null,
        photoIdUploadedAt: photoIdDocument ? signedAt : null,
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
        photoIdDocument: photoIdDocument || undefined,
        photoIdFileName: photoIdFileName || undefined,
        photoIdMimeType: photoIdMimeType || undefined,
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

                  <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 p-4">
                    {signatureImage ? (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-semibold text-foreground">
                            Saved signature
                          </p>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={openSignatureModal}
                          >
                            Change
                          </Button>
                        </div>
                        <div className="flex h-32 items-center justify-center rounded-xl bg-white shadow-inner">
                          <img
                            src={signatureImage}
                            alt="Saved customer signature"
                            className="max-h-24 max-w-full object-contain"
                          />
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3 text-center">
                        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                          <PenLine className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            Add your signature
                          </p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            Type, draw, or upload your legally accepted signature.
                          </p>
                        </div>
                        <Button type="button" variant="outline" onClick={openSignatureModal}>
                          <PenLine className="h-4 w-4" />
                          Add Signature
                        </Button>
                      </div>
                    )}
                  </div>

                  {invoice.photoIdRequired ? (
                    <div className="rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-4">
                      <div className="mb-3 flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            Photo ID required
                          </p>
                          <p className="mt-1 text-xs leading-5 text-muted-foreground">
                            Upload a driver license, passport, or other valid photo ID.
                          </p>
                        </div>
                        {photoIdDocument ? (
                          <BadgePill>Uploaded</BadgePill>
                        ) : null}
                      </div>
                      {photoIdDocument ? (
                        <div className="space-y-3">
                          <div className="rounded-xl border border-border bg-white p-3 text-sm text-foreground">
                            <p className="truncate font-medium">
                              {photoIdFileName || 'Photo ID document'}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {photoIdMimeType || 'Uploaded document'}
                            </p>
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setPhotoIdDocument('');
                              setPhotoIdFileName('');
                              setPhotoIdMimeType('');
                            }}
                          >
                            Choose another file
                          </Button>
                        </div>
                      ) : (
                        <label
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={handlePhotoIdDrop}
                          className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-xl border border-slate-300 bg-white px-4 py-6 text-center transition hover:border-primary/50 hover:bg-primary/5"
                        >
                          <UploadCloud className="h-7 w-7 text-primary" />
                          <p className="mt-2 text-sm font-semibold text-foreground">
                            Drop photo ID here or browse
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            PNG, JPG, BMP, WEBP, or PDF. Max 5 MB.
                          </p>
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/bmp,image/webp,application/pdf"
                            className="hidden"
                            onChange={handlePhotoIdInput}
                          />
                        </label>
                      )}
                    </div>
                  ) : null}

                  <p className="rounded-2xl bg-slate-50 px-4 py-3 text-center text-xs font-medium text-slate-700">
                    I understand that this is a legal representation of my signature.
                  </p>

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

                  {isSignatureModalOpen ? (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 px-4 py-6 backdrop-blur-sm">
                      <div className="flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-[1.35rem] bg-white shadow-2xl ring-1 ring-slate-900/10">
                        <div className="flex items-center justify-between px-6 py-5">
                          <h2 className="text-2xl font-semibold tracking-[-0.03em] text-slate-950">
                            Signature
                          </h2>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-9 w-9 rounded-full p-0 text-slate-500"
                            onClick={() => setIsSignatureModalOpen(false)}
                            aria-label="Close signature modal"
                          >
                            <X className="h-5 w-5" />
                          </Button>
                        </div>

                        <div className="space-y-5 overflow-auto px-6 pb-5">
                          <div className="grid grid-cols-3 overflow-hidden rounded-lg border border-slate-300">
                            {(['TYPE', 'DRAW', 'UPLOAD'] as SignatureMode[]).map((mode) => (
                              <button
                                key={mode}
                                type="button"
                                className={cn(
                                  'h-11 border-r border-slate-300 text-sm font-semibold transition last:border-r-0',
                                  signatureMode === mode
                                    ? 'border-primary bg-primary/10 text-primary ring-1 ring-inset ring-primary'
                                    : 'bg-white text-slate-900 hover:bg-slate-50',
                                )}
                                onClick={() => setSignatureMode(mode)}
                              >
                                {mode.charAt(0) + mode.slice(1).toLowerCase()}
                              </button>
                            ))}
                          </div>

                          {signatureMode === 'TYPE' ? (
                            <div className="space-y-4">
                              <label className="flex items-center gap-3 rounded-lg bg-slate-50 p-3 text-sm font-semibold text-slate-600">
                                <span className="shrink-0">Your name</span>
                                <input
                                  value={signatureName}
                                  onChange={(event) => setSignatureName(event.target.value)}
                                  className="h-10 min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-950 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                                />
                              </label>
                              <div className="grid gap-4 sm:grid-cols-2">
                                {TYPED_SIGNATURE_STYLES.map((style, index) => (
                                  <button
                                    key={style.label}
                                    type="button"
                                    className={cn(
                                      'relative flex h-28 items-center justify-center rounded-xl border bg-white px-5 text-left transition hover:border-primary/50',
                                      selectedTypedStyle === index
                                        ? 'border-primary ring-2 ring-primary/20'
                                        : 'border-slate-200',
                                    )}
                                    onClick={() => setSelectedTypedStyle(index)}
                                  >
                                    <span
                                      className="truncate text-5xl text-slate-950"
                                      style={{ fontFamily: style.font }}
                                    >
                                      {signatureName || 'Your name'}
                                    </span>
                                    <span className="absolute left-3 top-3 h-4 w-4 rounded-full border border-slate-300 bg-white">
                                      {selectedTypedStyle === index ? (
                                        <span className="m-1 block h-2 w-2 rounded-full bg-primary" />
                                      ) : null}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          ) : null}

                          {signatureMode === 'DRAW' ? (
                            <div className="space-y-3">
                              <div className="flex justify-end">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={clearSignature}
                                  className="text-primary"
                                >
                                  <RotateCcw className="h-4 w-4" />
                                  Clear
                                </Button>
                              </div>
                              <canvas
                                ref={drawCanvasRef}
                                onPointerDown={startDrawing}
                                onPointerMove={drawSignature}
                                onPointerUp={stopDrawing}
                                onPointerLeave={stopDrawing}
                                className={cn(
                                  'h-52 w-full touch-none rounded-sm border border-slate-300 bg-slate-50 shadow-inner',
                                  hasDrawing ? 'border-primary/70 bg-white' : null,
                                )}
                              />
                            </div>
                          ) : null}

                          {signatureMode === 'UPLOAD' ? (
                            <div className="space-y-4">
                              <label
                                onDragOver={(event) => event.preventDefault()}
                                onDrop={handleDrop}
                                className="flex min-h-40 cursor-pointer flex-col items-center justify-center rounded-sm border border-slate-300 bg-slate-50 px-6 py-8 text-center transition hover:border-primary/50 hover:bg-primary/5"
                              >
                                {uploadedSignatureImage ? (
                                  <img
                                    src={uploadedSignatureImage}
                                    alt="Uploaded signature preview"
                                    className="max-h-28 max-w-full object-contain"
                                  />
                                ) : (
                                  <>
                                    <UploadCloud className="h-8 w-8 text-slate-400" />
                                    <p className="mt-3 text-base text-slate-400">
                                      Drop signature files here...
                                    </p>
                                    <span className="mt-3 rounded-lg border border-primary px-4 py-2 text-sm font-semibold text-primary">
                                      Browse
                                    </span>
                                    <p className="mt-3 text-sm text-slate-600">
                                      Supported formats: PNG, JPG, BMP
                                    </p>
                                  </>
                                )}
                                <input
                                  type="file"
                                  accept="image/png,image/jpeg,image/bmp"
                                  className="hidden"
                                  onChange={handleUploadInput}
                                />
                              </label>
                              {uploadedSignatureImage ? (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setUploadedSignatureImage('')}
                                >
                                  <FileUp className="h-4 w-4" />
                                  Choose another file
                                </Button>
                              ) : null}
                            </div>
                          ) : null}
                        </div>

                        <div className="border-t border-slate-200 bg-slate-50/80">
                          <p className="px-6 py-2 text-center text-xs font-medium text-slate-900">
                            I understand that this is a legal representation of my signature
                          </p>
                          <div className="flex items-center justify-end gap-3 border-t border-slate-200 px-6 py-3">
                            <Button
                              type="button"
                              variant="outline"
                              className="min-w-28"
                              onClick={() => setIsSignatureModalOpen(false)}
                            >
                              Cancel
                            </Button>
                            <Button
                              type="button"
                              className="min-w-36 bg-[#3f0df6] hover:bg-[#3210bd]"
                              onClick={saveSignatureFromModal}
                            >
                              Save & use
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}
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

function BadgePill({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">
      {children}
    </span>
  );
}

function getCanvasPoint(event: PointerEvent<HTMLCanvasElement>) {
  const rect = event.currentTarget.getBoundingClientRect();

  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top,
  };
}

function prepareSignatureCanvas(canvas: HTMLCanvasElement) {
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
  context.lineWidth = 2.6;
  context.strokeStyle = '#0f172a';
}

function createTypedSignatureImage(name: string, styleIndex: number) {
  const canvas = document.createElement('canvas');
  const width = 720;
  const height = 220;
  const context = canvas.getContext('2d');
  const style = TYPED_SIGNATURE_STYLES[styleIndex] ?? TYPED_SIGNATURE_STYLES[0];

  canvas.width = width;
  canvas.height = height;

  if (!context) {
    return '';
  }

  context.clearRect(0, 0, width, height);
  context.fillStyle = '#020617';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.font = `96px ${style.font}`;
  context.fillText(name, width / 2, height / 2 + 5, width - 80);

  return canvas.toDataURL('image/png');
}

function fileToCompressedSignatureDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Unable to read signature image.'));
        return;
      }

      const image = new window.Image();
      image.onload = () => {
        const canvas = document.createElement('canvas');
        const maxWidth = 720;
        const maxHeight = 220;
        const scale = Math.min(maxWidth / image.width, maxHeight / image.height, 1);
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext('2d');

        canvas.width = maxWidth;
        canvas.height = maxHeight;

        if (!context) {
          reject(new Error('Unable to prepare signature image.'));
          return;
        }

        context.clearRect(0, 0, maxWidth, maxHeight);
        context.drawImage(
          image,
          (maxWidth - width) / 2,
          (maxHeight - height) / 2,
          width,
          height,
        );
        resolve(canvas.toDataURL('image/png'));
      };
      image.onerror = () => reject(new Error('Signature image could not be opened.'));
      image.src = result;
    };
    reader.onerror = () => reject(reader.error ?? new Error('Unable to read signature file.'));
    reader.readAsDataURL(file);
  });
}

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('Unable to read this file.'));
        return;
      }

      resolve(result);
    };
    reader.onerror = () => reject(reader.error ?? new Error('Unable to read this file.'));
    reader.readAsDataURL(file);
  });
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
