import { apiErrorMessage } from '@/shared/api-error';

export type EmergencyQuota = {
  yearMonth: string;
  limit: number;
  used: number;
  remaining: number;
};

export async function fetchEmergencyQuota(baseUrl: string, token: string): Promise<EmergencyQuota> {
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/focus-sessions/emergency-quota`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(apiErrorMessage(body, '紧急退出额度查询失败'));
  return body.data as EmergencyQuota;
}
