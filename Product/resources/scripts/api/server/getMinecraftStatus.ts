export interface MinecraftStatus {
    online: boolean;
    players: {
        online: number;
        max: number;
    };
}

interface MinecraftStatusResponse {
    online?: boolean;
    players?: {
        online?: number;
        max?: number;
    };
}

const offlineStatus: MinecraftStatus = {
    online: false,
    players: {
        online: 0,
        max: 0,
    },
};

export default async (address: string): Promise<MinecraftStatus> => {
    if (!address) {
        return offlineStatus;
    }

    try {
        const response = await fetch(`https://api.mcsrvstat.us/3/${encodeURIComponent(address)}`);

        if (!response.ok) {
            return offlineStatus;
        }

        const data = (await response.json()) as MinecraftStatusResponse;

        return {
            online: data.online === true,
            players: {
                online: data.players?.online ?? 0,
                max: data.players?.max ?? 0,
            },
        };
    } catch (error) {
        return offlineStatus;
    }
};
