import { NextResponse } from 'next/server';

const CRM_BASE_URL = 'https://crm.meeautoparts.com';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ contactId: string }> },
) {
  const { contactId } = await params;
  const [recordType, recordId] = decodeURIComponent(contactId).split(':', 2);
  const redirectUrl = new URL('/appconnect/lead/not-found', CRM_BASE_URL);

  if (recordType === 'order' && recordId) {
    redirectUrl.pathname = `/appconnect/order/${recordId}`;
  }

  if (recordType === 'lead' && recordId) {
    redirectUrl.pathname = `/appconnect/lead/${recordId}`;
  }

  return NextResponse.redirect(redirectUrl);
}
