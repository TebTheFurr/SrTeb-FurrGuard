import http from '@/api/http';

export default (uuid: string, name: string, description?: string, ipAlias?: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        http.post(`/api/client/servers/${uuid}/settings/rename`, { name, description, ip_alias: ipAlias })
            .then(() => resolve())
            .catch(reject);
    });
};
