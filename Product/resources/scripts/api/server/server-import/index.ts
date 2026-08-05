import http from '@/api/http';

export interface ServerImportCredentials {
    protocol: 'sftp' | 'ftp';
    host: string;
    port: number | string;
    username: string;
    password: string;
    remote_path: string;
}

export interface RemoteEntry {
    name: string;
    directory: boolean;
    size: number;
}

export interface ImportSkippedFile {
    path: string;
    reason: string;
}

export interface ImportProgress {
    status: 'importing' | 'completed' | 'failed' | 'cancelled';
    protocol: string;
    host: string;
    remoteBase: string;
    wipe: boolean;
    total: number;
    transferred: number;
    percent: number;
    current: string;
    bytesTotal: number;
    bytesDone: number;
    skipped: ImportSkippedFile[];
    error: string | null;
    startedAt: number;
    updatedAt: number;
}

export interface ImportStatusResponse {
    installed: boolean;
    enabled: boolean;
    eggAllowed?: boolean;
    maxFileSizeMb?: number;
    status: 'idle' | 'importing' | 'completed' | 'failed' | 'cancelled';
    progress: ImportProgress | null;
}

export const getImportStatus = (uuid: string): Promise<ImportStatusResponse> => {
    return new Promise((resolve, reject) => {
        http.get(`/api/client/servers/${uuid}/server-import`)
            .then(({ data }) => resolve(data))
            .catch(reject);
    });
};

export const testImportConnection = (
    uuid: string,
    credentials: ServerImportCredentials,
): Promise<{ success: boolean; entries?: RemoteEntry[]; error?: string }> => {
    return new Promise((resolve, reject) => {
        http.post(`/api/client/servers/${uuid}/server-import/test`, credentials)
            .then(({ data }) => resolve(data))
            .catch(reject);
    });
};

export const browseImportDirectory = (
    uuid: string,
    credentials: ServerImportCredentials,
    path: string,
): Promise<{ success: boolean; entries?: RemoteEntry[]; error?: string }> => {
    return new Promise((resolve, reject) => {
        http.post(`/api/client/servers/${uuid}/server-import/browse`, { ...credentials, path })
            .then(({ data }) => resolve(data))
            .catch(reject);
    });
};

export const startImport = (
    uuid: string,
    credentials: ServerImportCredentials,
    paths: string[],
    wipe: boolean,
): Promise<{ success: boolean; progress?: ImportProgress; error?: string }> => {
    return new Promise((resolve, reject) => {
        http.post(`/api/client/servers/${uuid}/server-import/start`, { ...credentials, paths, wipe })
            .then(({ data }) => resolve(data))
            .catch((err) => {
                const data = err.response?.data;

                if (data?.error && typeof data.error === 'string') {
                    resolve({ success: false, error: data.error });
                    return;
                }

                if (data?.errors?.[0]?.detail) {
                    resolve({ success: false, error: data.errors[0].detail });
                    return;
                }

                reject(err);
            });
    });
};

export const stepImport = (
    uuid: string,
): Promise<{ success: boolean; status: string; progress: ImportProgress | null }> => {
    return new Promise((resolve, reject) => {
        http.post(`/api/client/servers/${uuid}/server-import/step`)
            .then(({ data }) => resolve(data))
            .catch(reject);
    });
};

export const cancelImport = (uuid: string): Promise<{ success: boolean; status: string }> => {
    return new Promise((resolve, reject) => {
        http.post(`/api/client/servers/${uuid}/server-import/cancel`)
            .then(({ data }) => resolve(data))
            .catch(reject);
    });
};

export const resetImport = (uuid: string): Promise<{ success: boolean; status: string }> => {
    return new Promise((resolve, reject) => {
        http.post(`/api/client/servers/${uuid}/server-import/reset`)
            .then(({ data }) => resolve(data))
            .catch(reject);
    });
};
