import { NextResponse } from 'next/server';

const CRM_BASE_URL = 'https://crm.meeautoparts.com';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ contactId: string }> },
) {
  const { contactId } = await params;
  const [recordType, recordId] = decodeURIComponent(contactId).split(':', 2);
  const redirectUrl = new URL('/leads', CRM_BASE_URL);

  if (recordType === 'order' && recordId) {
    redirectUrl.pathname = `/orders/${recordId}`;
  }

  if (recordType === 'lead') {
    redirectUrl.pathname = '/leads';
  }

  return NextResponse.redirect(redirectUrl);
}
