import http from '@/api/http';

export interface Announcement {
    id: number;
    enabled: boolean;
    variation: 'split' | 'solid' | 'outline';
    placement: 'above-content' | 'topbar';
    type: 'info' | 'success' | 'warning' | 'error';
    icon: string;
    title: string;
    text: string;
    button_label: string | null;
    button_link: string | null;
    egg_ids: number[] | null;
    node_ids: number[] | null;
    is_permanent: boolean;
    expires_at: string | null;
    order: number;
    created_at: string;
    updated_at: string;
}

export const getAnnouncements = (nodeId?: number, eggIds?: number[]): Promise<Announcement[]> => {
    const params = new URLSearchParams();
    if (nodeId) {
        params.append('node_id', nodeId.toString());
    }
    if (eggIds && eggIds.length > 0) {
        params.append('egg_ids', eggIds.join(','));
    }

    return new Promise((resolve, reject) => {
        http.get(`/api/client/announcements?${params.toString()}`)
            .then(({ data }) => resolve(data as Announcement[]))
            .catch(reject);
    });
};
