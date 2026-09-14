import { requestBackend } from '@/lib/api/backend-api';
import {
  AppConnectRecordDetails,
  AppConnectRecordError,
  type AppConnectRecordDetail,
} from '../../AppConnectRecordDetails';

type AppConnectLeadPageProps = {
  params: Promise<{
    leadId: string;
  }>;
};

export default async function AppConnectLeadPage({
  params,
}: AppConnectLeadPageProps) {
  const { leadId } = await params;
  const result = await loadAppConnectRecord(`/appconnect/lead/${leadId}`);

  if (!result.success || !result.data) {
    return <AppConnectRecordError message={result.message} />;
  }

  return (
    <AppConnectRecordDetails
      actionLabel={getActionLabel(result.data)}
      detail={result.data}
    />
  );
}

async function loadAppConnectRecord(path: string) {
  const { status, payload } = await requestBackend<AppConnectRecordDetail>(path);

  if (status >= 400 || !payload.success || !payload.data) {
    return {
      success: false,
      message: payload.message || 'Unable to load lead details.',
      data: null,
    };
  }

  return {
    success: true,
    message: payload.message,
    data: payload.data,
  };
}

function getActionLabel(detail: AppConnectRecordDetail): string {
  return detail.crmUrl.includes('/orders/')
    ? 'Open Order in CRM'
    : 'Open Leads Table';
}
