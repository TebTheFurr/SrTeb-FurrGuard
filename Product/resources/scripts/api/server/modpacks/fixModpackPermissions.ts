import http from '@/api/http';

export default async function fixModpackPermissions(uuid: string): Promise<{ success: boolean; error?: string }> {
    const { data } = await http.post(`/api/client/servers/${uuid}/modpacks/fix-permissions`);
    return data;
}
