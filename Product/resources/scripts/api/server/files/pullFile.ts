import http from '@/api/http';

interface PullFileParams {
    url: string;
    directory: string;
    filename?: string;
    useHeader?: boolean;
    foreground?: boolean;
}

export default async (uuid: string, params: PullFileParams): Promise<void> => {
    await http.post(`/api/client/servers/${uuid}/files/pull`, {
        url: params.url,
        directory: params.directory,
        filename: params.filename,
        use_header: params.useHeader ?? false,
        foreground: params.foreground ?? true,
    });
};
