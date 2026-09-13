import { NextResponse } from 'next/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ contactId: string }> },
) {
  const { contactId } = await params;
  const [recordType, recordId] = decodeURIComponent(contactId).split(':', 2);
  const redirectUrl = new URL('/leads', request.url);

  if (recordType === 'order' && recordId) {
    redirectUrl.pathname = `/orders/${recordId}`;
  }

  if (recordType === 'lead') {
    redirectUrl.pathname = '/leads';
  }

  return NextResponse.redirect(redirectUrl);
}
