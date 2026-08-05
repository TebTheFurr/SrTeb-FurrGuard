import http from '@/api/http';

export interface AvailableEgg {
    id: number;
    name: string;
    nest_name: string;
    description: string;
    docker_images: Record<string, string>;
    startup: string;
}

export interface SrvConfig {
    srv_service: string;
    srv_protocol: string;
}

export interface EggChangerStatus {
    enabled: boolean;
    eggs: AvailableEgg[];
    current_egg_id: number;
    current_egg_name: string;
    always_reinstall: boolean;
    always_change_startup: boolean;
    nest_locked: boolean;
    srv_config: SrvConfig;
    egg_srv_configs: Record<number, SrvConfig>;
    allocation_ip: string;
    allocation_port: number;
}

export interface ChangeEggResponse {
    success: boolean;
    message: string;
    new_egg_id: number;
    new_egg_name: string;
    reinstalled: boolean;
    files_cleared: boolean;
}

export async function getEggChangerStatus(uuid: string): Promise<EggChangerStatus> {
    const { data } = await http.get(`/api/client/servers/${uuid}/egg/available`);
    return data;
}

export async function changeEgg(
    uuid: string,
    eggId: number,
    reinstall: boolean,
    changeStartup: boolean,
    clearFiles: boolean
): Promise<ChangeEggResponse> {
    const { data } = await http.post(`/api/client/servers/${uuid}/egg/change`, {
        egg_id: eggId,
        reinstall,
        change_startup: changeStartup,
        clear_files: clearFiles,
    });
    return data;
}
