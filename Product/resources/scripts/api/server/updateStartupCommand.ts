import http from '@/api/http';

export default async (uuid: string, startup: string): Promise<void> => {
    await http.put(`/api/client/servers/${uuid}/startup`, { startup });
};
