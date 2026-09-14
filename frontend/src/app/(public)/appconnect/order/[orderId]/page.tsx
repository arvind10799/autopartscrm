import { requestBackend } from '@/lib/api/backend-api';
import {
  AppConnectRecordDetails,
  AppConnectRecordError,
  type AppConnectRecordDetail,
} from '../../AppConnectRecordDetails';

type AppConnectOrderPageProps = {
  params: Promise<{
    orderId: string;
  }>;
};

export default async function AppConnectOrderPage({
  params,
}: AppConnectOrderPageProps) {
  const { orderId } = await params;
  const result = await loadAppConnectRecord(`/appconnect/order/${orderId}`);

  if (!result.success || !result.data) {
    return <AppConnectRecordError message={result.message} />;
  }

  return (
    <AppConnectRecordDetails
      actionLabel="Open Order in CRM"
      detail={result.data}
    />
  );
}

async function loadAppConnectRecord(path: string) {
  const { status, payload } = await requestBackend<AppConnectRecordDetail>(path);

  if (status >= 400 || !payload.success || !payload.data) {
    return {
      success: false,
      message: payload.message || 'Unable to load order details.',
      data: null,
    };
  }

  return {
    success: true,
    message: payload.message,
    data: payload.data,
  };
}
