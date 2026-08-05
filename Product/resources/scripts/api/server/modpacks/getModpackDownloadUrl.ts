import http from '@/api/http';

export interface ModpackDownloadUrlResult {
    downloadUrl: string | null;
    fileName: string | null;
    useHeader: boolean;
    error?: string | null;
}

export default async function getModpackDownloadUrl(
    uuid: string,
    platform: string,
    modpackId: string,
    versionId: string
): Promise<ModpackDownloadUrlResult> {
    const { data } = await http.get(`/api/client/servers/${uuid}/modpacks/download-url`, {
        params: {
            platform,
            modpackId,
            versionId,
        },
    });

    return data;
}
